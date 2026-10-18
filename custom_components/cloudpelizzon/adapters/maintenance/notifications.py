"""Public notification scheduling/transport. All message and due-date policy is private.

Delivery is opt-in per HA; no settings or destinations are approved implicitly.
The timer drives bounded remote checks/drains, not local maintenance calculations.
"""
import asyncio
from collections.abc import Mapping
from datetime import timedelta
import functools
import re
import time
import uuid
from .notification_relay import NotificationRelay
from .bridge import CONTRACTS,detached

PREFIX='cloudpelizzon/maintenance/notifications/'
FIELDS={'enabled','services','targets','volume_entities'}

def permissions(value):
    if not isinstance(value,Mapping) or set(value)-FIELDS:
        raise ValueError('notification_delivery_permissions')
    enabled=value.get('enabled',False)
    if type(enabled) is not bool:
        raise ValueError('notification_delivery_enabled')
    services=value.get('services',[]);targets=value.get('targets',[]);volumes=value.get('volume_entities',[])
    for items in (services,targets,volumes):
        if not isinstance(items,list) or len(items)>100 or any(not isinstance(x,str) for x in items) or len(items)!=len(set(items)):
            raise ValueError('notification_delivery_list')
    if any(re.fullmatch(r'(?:notify|script)\.[a-z0-9_]+|media_player\.volume_set',x) is None for x in services):
        raise ValueError('notification_service_approval')
    if any(re.fullmatch(r'media_player\.[a-z0-9_]+',x) is None for x in targets) or not set(volumes)<=set(targets):
        raise ValueError('notification_target_approval')
    if enabled and not services:
        raise ValueError('notification_explicit_services_required')
    return {'enabled':enabled,'services':services[:],'targets':targets[:],'volume_entities':volumes[:]}

class NotificationAdapter:
    def __init__(self,hass,bridge,execute,relay=None,*,monotonic=None,tracker=None):
        self.hass=hass;self.bridge=bridge;self.execute=execute;self.relay=relay
        self.monotonic=monotonic or time.monotonic;self.tracker=tracker
        self.closed=False;self._unsub=None;self.task=None;self.lock=asyncio.Lock()
        self.next_check=0.;self.pending=False;self.last_error=None
        self.delivery_attempts=0

    @property
    def enabled(self):return self.relay is not None and not self.closed

    async def remote(self,operation,args):
        if self.closed:raise PermissionError('notification_adapter_closed')
        result=await self.execute(operation,detached(args),uuid.uuid4().hex)
        if self.closed:raise PermissionError('notification_adapter_closed')
        return detached(result)

    async def state(self):
        result=await self.remote('maintenance.notifications.status',{})
        return {**result,'running':self.enabled and self._unsub is not None,
            'scheduler':'HA_remote_adapter','delivery_enabled':self.enabled,
            'adapter_error':self.last_error}

    async def drain(self):
        status=await self.state();self.pending=bool(status.get('pending'))
        jobs=set();channels={}
        for _ in range(20):
            if not self.pending or self.closed:break
            row=await self.relay.poll_once()
            self.delivery_attempts+=row.get('device_calls',0)
            if row.get('outcome')=='idle':break
            if row.get('outcome')=='success' and row.get('acknowledged') is True:
                job=row.get('job_id')
                channels.setdefault(job,[]).append(row['service'])
                if row.get('delivered') is True:jobs.add(job)
        status=await self.state();self.pending=bool(status.get('pending'))
        return jobs,channels

    async def handle(self,command,payload=None,*,admin=False):
        if command not in (PREFIX+'status',PREFIX+'test',PREFIX+'check_now'):
            raise ValueError('notification_command')
        spec=CONTRACTS[command]
        if spec['admin'] and admin is not True:raise PermissionError('admin_required')
        payload={} if payload is None else detached(payload)
        if not isinstance(payload,dict) or set(payload)-set(spec['allowed']):raise ValueError('notification_arguments')
        if command==PREFIX+'status':return await self.state()
        if not self.enabled:
            return {'allowed':False,'delivered':False,'queued':False,'processed':False,'sent':0,'channels':[],
                'result':'Entrega desabilitada neste HA. É necessária aprovação explícita dos destinos.'}
        async with self.lock:
            result=await self.bridge.handle(command,payload,admin=admin)
            if result.get('throttled'):return {**result,'channels':[]}
            jobs,channels=await self.drain()
            if command==PREFIX+'check_now':return {**result,'sent':len(jobs)}
            job=result.get('job_id')
            delivered=job is not None and job in jobs
            return {**result,'delivered':delivered,'channels':channels.get(job,[]) if delivered else [],
                'result':'acknowledged' if delivered else 'Aguardando confirmação da entrega pelo servidor.'}

    async def tick(self):
        if not self.enabled or self.lock.locked():return {'processed':False,'sent':0}
        async with self.lock:
            try:
                if self.monotonic()>=self.next_check:
                    self.next_check=self.monotonic()+300
                    await self.remote('maintenance.notifications.check',{'reason':'interval'})
                    status=await self.state();self.pending=bool(status.get('pending'))
                jobs,_=await self.drain() if self.pending else (set(),{})
                self.last_error=None
                return {'processed':True,'sent':len(jobs)}
            except asyncio.CancelledError:raise
            except Exception as error:
                self.pending=False;self.last_error=type(error).__name__
                return {'processed':False,'sent':0,'error':'cloud_denied_or_unavailable'}

    async def async_start(self):
        if not self.enabled or self._unsub is not None:return
        def on_tick(_now):
            if self.closed or (self.task is not None and not self.task.done()):return
            self.task=self.hass.async_create_task(self.tick())
        tracker=self.tracker
        if tracker is None:
            from homeassistant.core import callback
            from homeassistant.helpers.event import async_track_time_interval
            on_tick=callback(on_tick);tracker=async_track_time_interval
        self._unsub=tracker(self.hass,on_tick,timedelta(seconds=5))

    def close(self):
        if self.closed:return
        self.closed=True
        if self._unsub:self._unsub();self._unsub=None
        if self.relay:self.relay.close()
        if self.task is not None and not self.task.done():self.task.cancel()

    async def async_stop(self):
        self.close()
        if self.task is not None and self.task is not asyncio.current_task():
            await asyncio.gather(self.task,return_exceptions=True)

async def create(hass,entry,iid,client,folder,bridge):
    options=entry.options
    if not isinstance(options,Mapping):raise ValueError('notification_entry_options')
    config=permissions(options.get('maintenance_delivery',{}))
    async def execute(operation,args,rid):
        return await hass.async_add_executor_job(functools.partial(client.execute,'CP-MAINTENANCE',operation,args,request_id=rid))
    relay=None
    if config['enabled']:
        relay=await hass.async_add_executor_job(functools.partial(NotificationRelay.from_client,hass,client,iid,folder/'notification_delivery56.sqlite3',
            approved_services=config['services'],approved_targets=config['targets'],volume_entities=config['volume_entities']))
    return NotificationAdapter(hass,bridge,execute,relay)
