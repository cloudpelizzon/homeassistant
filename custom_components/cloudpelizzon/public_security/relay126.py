"""Public HA edge candidate: verify exact grants, deduplicate, call allowed services.

Gateway transport and HA async service call are supplied by the integration.
No rules, templates, schedulers or commercial module logic run on this edge.
"""
import asyncio,sqlite3,uuid
from contextlib import closing
from datetime import datetime,timezone
from .wire126 import AUTHORITY,command,detach,digest,ident,instant,verify_receipt
from ..adapters.automation.lib.cloudpelizzon_relay.protocol import secure_db

class RelayClient:
    def __init__(self,iid,database,*,allowed_entities,gateway,call_service,clock=None,public=AUTHORITY):
        if not ident(iid,'[A-Za-z0-9_-]{8,160}'):raise ValueError('installation_id')
        self.iid=iid;self.db=secure_db(database);self.allowed=tuple(tuple(row) for row in allowed_entities)
        self.gateway=gateway;self.call_service=call_service;self.clock=clock or (lambda:datetime.now(timezone.utc));self.public=public
        with closing(sqlite3.connect(self.db)) as con,con:
            con.execute('CREATE TABLE IF NOT EXISTS relay_calls(iid TEXT,cid TEXT,digest TEXT,state TEXT,PRIMARY KEY(iid,cid))')
            con.execute('CREATE TABLE IF NOT EXISTS relay_clock(id INTEGER PRIMARY KEY,highwater REAL NOT NULL)')
    async def deliver(self,descriptor):
        if not isinstance(descriptor,dict) or set(descriptor)!={'command_id','command'}:raise ValueError('descriptor_invalid')
        cid=descriptor['command_id'];value=command(descriptor['command'],self.iid,self.allowed)
        if not ident(cid,'[a-f0-9]{32}'):raise ValueError('command_identity')
        claim={'stage':'claim','command_id':cid,'command_sha256':digest(value)}
        lease=await self.gateway(claim,uuid.uuid4().hex)
        if (not isinstance(lease,dict) or set(lease)!={'command_id','lease_id','expires_at'} or lease['command_id']!=cid
            or not ident(lease['lease_id'],'[a-f0-9]{32}') or not self.clock()<instant(lease['expires_at'])):raise PermissionError('lease_invalid')
        confirm={'stage':'confirm','command_id':cid,'lease_id':lease['lease_id'],'command':value}
        rid=uuid.uuid4().hex;grant=await self.gateway(confirm,rid)
        result=await self.apply(grant,confirm,rid)
        try:
            await self.gateway({'stage':'ack','command_id':cid,'lease_id':lease['lease_id'],'outcome':result['outcome']},uuid.uuid4().hex)
        except Exception:result['acknowledged']=False
        else:result['acknowledged']=True
        return result
    async def apply(self,grant,args,rid):
        grant=detach(grant);args=detach(args)
        if (not isinstance(grant,dict) or set(grant)!={'command','receipt','expires_at'}
            or not isinstance(args,dict) or set(args)!={'stage','command_id','lease_id','command'} or args['stage']!='confirm'
            or not ident(args['command_id'],'[a-f0-9]{32}') or not ident(args['lease_id'],'[a-f0-9]{32}')
            or not ident(rid,'[A-Za-z0-9_-]{16,128}')):raise PermissionError('grant_invalid')
        value=command(grant['command'],self.iid,self.allowed)
        if value!=args['command'] or not verify_receipt(grant['receipt'],self.iid,{'action':'effects','payload':args},rid,self.clock(),self.public):raise PermissionError('grant_not_verified')
        expires=min(instant(grant['expires_at']),instant(grant['receipt']['claims']['expires_at']))
        now=self.clock()
        if not now<expires:raise PermissionError('grant_expired')
        with closing(sqlite3.connect(self.db,timeout=5)) as con,con:
            con.execute('BEGIN IMMEDIATE')
            high=con.execute('SELECT highwater FROM relay_clock WHERE id=1').fetchone()
            if high and now.timestamp()<high[0]-2:raise PermissionError('clock_rollback')
            if con.execute('SELECT COUNT(*) FROM relay_calls').fetchone()[0]>=50000:raise PermissionError('relay_ledger_capacity')
            if con.execute('SELECT 1 FROM relay_calls WHERE iid=? AND cid=?',(self.iid,args['command_id'])).fetchone():raise PermissionError('command_already_started')
            con.execute('INSERT INTO relay_calls VALUES(?,?,?,?)',(self.iid,args['command_id'],digest(value),'started'))
            con.execute('INSERT INTO relay_clock VALUES(1,?) ON CONFLICT(id) DO UPDATE SET highwater=MAX(highwater,excluded.highwater)',(now.timestamp(),))
        # The durable reservation precedes the device call. A crash/timeout never
        # justifies replaying it; exactly-once delivery cannot be guaranteed.
        outcome='uncertain'
        try:
            if not self.clock()<expires:raise PermissionError('grant_expired_before_dispatch')
            await asyncio.wait_for(self.call_service(value['service'],detach(value['data'])),timeout=10)
            outcome='success'
        except Exception:
            outcome='uncertain'
        finally:
            with closing(sqlite3.connect(self.db)) as con,con:
                con.execute('UPDATE relay_calls SET state=? WHERE iid=? AND cid=?',(outcome,self.iid,args['command_id']))
        return {'command_id':args['command_id'],'outcome':outcome}
