"""Public leased notification consumer; no scheduling or message policy here.

Not installed/enabled automatically. Local service/target approval is mandatory.
Remote SDK authorizes claim and exact confirmation separately. A durable local
reservation precedes confirmation/call; ambiguous outcomes are never retried.
"""
import asyncio
from contextlib import closing
from datetime import datetime, timezone, timedelta
import functools
import hashlib
import json
import math
import re
import sqlite3
import time
import uuid
from .ledger import secure_db

OP = 'maintenance.notifications.dispatch'

def encode(value):
    raw = json.dumps(value, sort_keys=True, ensure_ascii=False, allow_nan=False, separators=(',', ':')).encode()
    if len(raw) > 20000:
        raise ValueError('notification_body_size')
    return raw

def instant(value):
    if not isinstance(value,str):
        raise ValueError('notification_time')
    result = datetime.fromisoformat(value.replace('Z','+00:00'))
    if result.tzinfo is None:
        raise ValueError('notification_timezone')
    return result.astimezone(timezone.utc)

def valid_text(value):
    return isinstance(value,str) and 0 < len(value) <= 4000

class NotificationRelay:
    def __init__(self, iid, database, *, execute, call_service, approved_services=(), approved_targets=(), volume_entities=(), read_volume=None, clock=None, monotonic=None, receipt_public=None):
        if not isinstance(iid,str) or re.fullmatch(r'[A-Za-z0-9_-]{8,160}',iid) is None:
            raise ValueError('installation_id')
        from .receipt import AUTHORITY
        self.receipt_public=AUTHORITY if receipt_public is None else receipt_public
        self.iid=iid
        self.db=secure_db(database)
        self.execute=execute
        self.call_service=call_service
        self.services=frozenset(approved_services)
        self.targets=frozenset(approved_targets)
        self.volume_entities=frozenset(volume_entities)
        self.read_volume=read_volume
        if any(not isinstance(s,str) or not re.fullmatch(r'(?:notify|script)\.[a-z0-9_]+|media_player\.volume_set',s) for s in self.services):
            raise ValueError('notification_service_approval')
        if any(not isinstance(s,str) or not re.fullmatch(r'media_player\.[a-z0-9_]+',s) for s in self.targets):
            raise ValueError('notification_target_approval')
        if not self.volume_entities<=self.targets or (self.volume_entities and not callable(read_volume)):
            raise ValueError('notification_volume_read_permission')
        self.clock=clock or (lambda:datetime.now(timezone.utc))
        self.monotonic=monotonic or time.monotonic
        self.closed=False
        self.lock=asyncio.Lock()
        with closing(sqlite3.connect(self.db)) as con,con:
            con.execute('CREATE TABLE IF NOT EXISTS notification_calls(iid TEXT,job TEXT,step INTEGER,digest TEXT,state TEXT,PRIMARY KEY(iid,job,step))')
            con.execute('CREATE TABLE IF NOT EXISTS notification_clock(id INTEGER PRIMARY KEY,highwater REAL NOT NULL)')

    @classmethod
    def from_client(cls,hass,client,iid,database,**kwargs):
        async def execute(args,rid):
            return await hass.async_add_executor_job(functools.partial(client.execute,'CP-MAINTENANCE',OP,args,request_id=rid))
        async def call(service,data):
            domain,name=service.split('.',1)
            if not hass.services.has_service(domain,name):
                raise PermissionError('notification_service_unavailable')
            await hass.services.async_call(domain,name,data,blocking=True)
        def read_volume(entity):
            row=hass.states.get(entity)
            return row.attributes.get('volume_level') if row is not None else None
        return cls(iid,database,execute=execute,call_service=call,read_volume=read_volume,**kwargs)

    def close(self):
        self.closed=True

    def validate(self,command):
        command=json.loads(encode(command))
        fields={'job_id','step','lease_id','issued_at','expires_at','service','data'}
        if not isinstance(command,dict) or set(command)!=fields:
            raise ValueError('notification_command')
        if any(not isinstance(command[k],str) or not re.fullmatch(r'[a-f0-9]{32}',command[k]) for k in ('job_id','lease_id')):
            raise ValueError('notification_identity')
        if type(command['step']) is not int or not 0<=command['step']<500:
            raise ValueError('notification_step')
        if command['service'] not in self.services or not isinstance(command['data'],dict):
            raise PermissionError('notification_service_not_approved')
        issued,expires=instant(command['issued_at']),instant(command['expires_at'])
        if not issued<=self.clock()<expires<=issued+timedelta(seconds=5):
            raise PermissionError('notification_lease_expired')
        data=command['data'];service=command['service']
        if service.startswith('script.'):
            if set(data)!={'titulo','mensagem','codigo'} or not all(valid_text(v) for v in data.values()):
                raise ValueError('notification_script_data')
        elif service=='media_player.volume_set':
            if set(data)!={'entity_id','volume_level'}:
                raise ValueError('notification_volume_data')
            volume=data['volume_level']
            if type(volume) not in (int,float) or not math.isfinite(volume) or not 0<=volume<=1:
                raise ValueError('notification_volume')
            self.validate_targets(data['entity_id'])
        elif set(data)=={'title','message'}:
            if not all(valid_text(v) for v in data.values()):
                raise ValueError('notification_mobile_data')
        elif set(data)=={'target','message','data'}:
            self.validate_targets(data['target'])
            if not valid_text(data['message']) or data['data']!={'type':'announce','method':'all'}:
                raise ValueError('notification_alexa_data')
        else:
            raise ValueError('notification_data')
        return command

    def validate_targets(self,targets):
        targets=[targets] if isinstance(targets,str) else targets
        if not isinstance(targets,list) or not targets or len(targets)>100 or any(not isinstance(t,str) or t not in self.targets for t in targets):
            raise PermissionError('notification_target_not_approved')

    def reserve(self,command,now):
        with closing(sqlite3.connect(self.db,timeout=5)) as con,con:
            con.execute('BEGIN IMMEDIATE')
            high=con.execute('SELECT highwater FROM notification_clock WHERE id=1').fetchone()
            if high and now.timestamp()<high[0]:
                raise PermissionError('notification_clock_rollback')
            if con.execute('SELECT COUNT(*) FROM notification_calls').fetchone()[0]>=50000:
                raise PermissionError('notification_ledger_capacity')
            try:
                con.execute('INSERT INTO notification_calls VALUES(?,?,?,?,?)',(self.iid,command['job_id'],command['step'],hashlib.sha256(encode(command)).hexdigest(),'reserved'))
            except sqlite3.IntegrityError:
                raise PermissionError('notification_already_reserved') from None
            con.execute('INSERT INTO notification_clock VALUES(1,?) ON CONFLICT(id) DO UPDATE SET highwater=MAX(highwater,excluded.highwater)',(now.timestamp(),))

    def mark(self,command,outcome):
        with closing(sqlite3.connect(self.db)) as con,con:
            con.execute('UPDATE notification_calls SET state=? WHERE iid=? AND job=? AND step=?',(outcome,self.iid,command['job_id'],command['step']))

    async def rpc(self,args):
        if self.closed:
            raise PermissionError('notification_relay_closed')
        return await self.execute(json.loads(encode(args)),uuid.uuid4().hex)

    async def confirm(self,command):
        from .receipt import verify
        if self.closed:raise PermissionError('notification_relay_closed')
        args={'stage':'confirm','command':command,'receipt_version':1}
        rid=uuid.uuid4().hex
        started=self.monotonic()
        result=await self.execute(json.loads(encode(args)),rid)
        if not isinstance(result,dict) or not verify(result.get('receipt'),self.iid,args,rid,self.clock(),self.receipt_public):
            raise PermissionError('notification_receipt_invalid')
        return result,args,rid,started

    async def poll_once(self):
        async with self.lock:
            if self.closed:
                raise PermissionError('notification_relay_closed')
            if not self.services:
                return {'outcome':'disabled_no_approved_services','device_calls':0}
            started=self.monotonic()
            # Only explicit volume read grants; no whole-state/service enumeration.
            states={}
            for entity in sorted(self.volume_entities):
                value=self.read_volume(entity)
                if type(value) in (int,float) and math.isfinite(value) and 0<=value<=1:
                    states[entity]={'volume_level':value}
            available=self.services if self.targets and set(states)==self.targets else self.services-{'media_player.volume_set'}
            result=await self.rpc({'stage':'claim','available_services':sorted(available),'states':states})
            if not isinstance(result,dict):
                raise ValueError('notification_claim')
            if result.get('command') is None:
                return {'outcome':'idle','device_calls':0}
            command=self.validate(result['command'])
            now=self.clock()
            expires=instant(command['expires_at'])
            deadline=started+min(5,(expires-now).total_seconds())
            if self.monotonic()>=deadline:
                raise PermissionError('notification_monotonic_expiry')
            self.reserve(command,now)
            outcome='uncertain';called=False
            try:
                confirmation,confirm_args,confirm_rid,confirm_started=await self.confirm(command)
                if not isinstance(confirmation,dict) or set(confirmation)!={'confirmed','command','receipt'} or confirmation['confirmed'] is not True or encode(confirmation['command'])!=encode(command):
                    raise PermissionError('notification_confirmation_not_bound')
                self.validate(command)
                from .receipt import verify
                if not verify(confirmation['receipt'],self.iid,confirm_args,confirm_rid,self.clock(),self.receipt_public):
                    raise PermissionError('notification_receipt_expired_before_call')
                deadline=min(deadline,confirm_started+(instant(confirmation['receipt']['claims']['expires_at'])-self.clock()).total_seconds())
                if self.closed or self.clock()<now or self.monotonic()>=deadline:
                    raise PermissionError('notification_confirmation_stale')
                called=True
                try:
                    await asyncio.wait_for(self.call_service(command['service'],json.loads(encode(command['data']))),timeout=4)
                    outcome='success'
                except asyncio.CancelledError:
                    raise
                except Exception:
                    outcome='uncertain'
            finally:
                self.mark(command,outcome)
            acknowledged=False;delivered=False
            try:
                ack=await self.rpc({'stage':'ack','job_id':command['job_id'],'lease_id':command['lease_id'],'step':command['step'],'success':outcome=='success'})
                acknowledged=True;delivered=ack.get('delivered') is True
            except Exception:
                pass
            return {'outcome':outcome,'device_calls':int(called),'acknowledged':acknowledged,'delivered':delivered,'job_id':command['job_id'],'service':command['service']}
