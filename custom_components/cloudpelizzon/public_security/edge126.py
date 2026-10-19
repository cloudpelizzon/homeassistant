"""Public HA transport only: approved state snapshots and signed relay delivery.

The gateway owns rules, schedules, authorization and execution. No local engine.
All synchronous SDK and durable relay work is delegated to the HA executor.
"""
import asyncio,json,re,uuid
from datetime import datetime,timedelta,timezone
from functools import partial

from .wire126 import policy,permitted

class Edge:
    def __init__(self,client,*,executor,snapshot,read_policy,save_policy,service,relay_factory,clock=None,before_snapshot=None):
        self.client=client;self.executor=executor;self.snapshot=snapshot
        self.read_policy=read_policy;self.save_policy=save_policy;self.service=service;self.relay_factory=relay_factory
        self.clock=clock or (lambda:datetime.now(timezone.utc));self.closed=False;self.lock=asyncio.Lock()
        self.generation=uuid.uuid4().hex;self.task=None;self.connected=False;self.fault=None;self.relay=None;self.consent=None
        self.refresh_status=True;self.prepared_until=None;self.native=None;self.native_at=None;self.native_listeners=set();self.before_snapshot=before_snapshot
    def check(self,generation=None):
        if self.closed or generation is not None and generation!=self.generation:raise PermissionError('runtime_or_permissions_changed')
        return policy(self.read_policy())
    async def call(self,name,*args,**kwargs):
        self.check();return await self.executor(partial(getattr(self.client,name),*args,**kwargs))
    def feed(self,value):
        states=self.snapshot(value['reads'])
        if type(states) is not dict or not set(states)<=set(value['reads']) or len(json.dumps(states,allow_nan=False).encode())>40000:raise ValueError('snapshot_limit')
        return {'states':states,'sampled_at':self.clock().isoformat()}
    async def prepare(self,*,new_policy=None,confirmed=False,authorized=lambda:True):
        async with self.lock:
            current=self.check();value=current if new_policy is None else policy(new_policy)
            if not authorized():raise PermissionError('active_admin_required')
            if value!=current and (value['reads'] or value['effects']) and confirmed is not True:raise PermissionError('explicit_consent_required')
            token=self.generation=uuid.uuid4().hex;self.connected=False;self.relay=None;self.consent=None
            result=await self.call('security_session',{'action':'prepare','policy':value,'confirmed':confirmed,**self.feed(value)},request_id=uuid.uuid4().hex)
            self.check(token)
            if not authorized():raise PermissionError('active_admin_required')
            if result!={'prepared':True,'policy':value,'trial_started':False}:raise PermissionError('prepare_response_binding')
            if new_policy is not None:self.save_policy(value)
            self.check(token);self.connected=True;self.fault=None;self.refresh_status=True
            self.prepared_until=self.clock()+timedelta(seconds=15)
            return {'prepared':True,'policy':value,'trial_started':False}
    async def dispatch(self,token,approved,service,data,expires=None):
        # This check runs on HA's event loop immediately before dispatch.
        self.check(token)
        if not self.connected or self.check()!=approved or self.consent!=approved:raise PermissionError('delivery_consent_changed')
        if expires is None or expires.tzinfo is None or not self.clock()<expires:raise PermissionError('grant_expired_before_HA_dispatch')
        domain,name=service.split('.')
        target=data.get('entity_id','')
        if type(target) is not str or [domain,name,target] not in approved['effects'] or not permitted(domain,name,target):raise PermissionError('unapproved_security_effect')
        from ..homolog_mirror.source132 import DELIVERY_CHECK
        def valid_delivery():
            self.check(token)
            if not self.connected or self.check()!=approved or self.consent!=approved or not self.clock()<expires:raise PermissionError('delivery_expired_or_changed')
        context=DELIVERY_CHECK.set(valid_delivery)
        try:await self.service(domain,name,data)
        finally:DELIVERY_CHECK.reset(context)
    async def deliver(self,descriptor,approved,token):
        loop=asyncio.get_running_loop()
        deadline={}
        async def service(name,data):
            future=asyncio.run_coroutine_threadsafe(self.dispatch(token,approved,name,data,deadline.get('expires')),loop)
            await asyncio.wrap_future(future)
        def run():
            # The SQLite ledger and SDK stay entirely off HA's event loop.
            async def gateway(args,rid):
                result=self.client.security('effects',args,request_id=rid)
                if args.get('stage')=='confirm':
                    deadline['expires']=min(datetime.fromisoformat(result['expires_at'].replace('Z','+00:00')),
                        datetime.fromisoformat(result['receipt']['claims']['expires_at'].replace('Z','+00:00')))
                return result
            if self.relay is None:self.relay=self.relay_factory(approved['effects'],gateway,service)
            return asyncio.run(self.relay.deliver(descriptor))
        result=await self.executor(run);self.check(token)
        if result.get('outcome')!='success' or result.get('acknowledged') is not True:raise PermissionError('delivery_unconfirmed_no_automatic_retry')
    async def cycle(self):
        async with self.lock:
            approved=self.check();token=self.generation
            if self.before_snapshot is not None:await self.before_snapshot(approved)
            self.check(token)
            if self.check()!=approved:raise PermissionError('snapshot_permissions_changed')
            result=await self.call('security','feed',self.feed(approved),request_id=uuid.uuid4().hex)
            self.check(token)
            if self.check()!=approved or type(result) is not dict or result.get('connected') is not True or type(result.get('faults')) is not list:raise PermissionError('security_feed_binding')
            self.connected=True;self.consent=approved
            if 'native' in result:self.native_update(result['native'])
            self.fault='some_engines_require_configuration_or_permissions' if result['faults'] else None
            if approved['effects'] and result.get('shadow_mode') is False:
                pending=await self.call('security','effects',{'stage':'pending'},request_id=uuid.uuid4().hex);self.check(token)
                if type(pending.get('commands')) is not list or len(pending['commands'])>20:raise PermissionError('security_queue_response')
                for item in pending['commands']:await self.deliver(item,approved,token)

    def native_update(self,value):
        allowed={'disarmed','arming','armed_home','armed_away','pending','triggered','panic','unknown'}
        if type(value) is not dict or value.get('alarm') not in allowed or value.get('mode') not in {'Casa','Ausente','Dormindo','Viagem','Férias','Visitantes'}:raise ValueError('native_state_binding')
        self.native=json.loads(json.dumps(value,allow_nan=False));self.native_at=self.clock()
        for listener in tuple(self.native_listeners):listener()
    async def native_command(self,action,payload,*,authorized=lambda:True):
        async with self.lock:
            self.check();token=self.generation
            if not authorized():raise PermissionError('active_admin_required')
            if action not in {'alarm.arm_home','alarm.arm_away','alarm.disarm','alarm.panic','alarm.trigger','native.mode'}:raise ValueError('native_action')
            result=await self.call('security',action,payload,request_id=uuid.uuid4().hex)
            self.check(token)
            if not authorized():raise PermissionError('session_changed')
            self.native_update(result['native'])
            return {'native':self.native,'effects_queued':result['queued']}
    async def manual(self,service,data,*,authorized):
        async with self.lock:
            approved=self.check();token=self.generation
            if not authorized():raise PermissionError('active_admin_required')
            result=await self.call('security','manual',{'service':service,'data':data},request_id=uuid.uuid4().hex)
            self.check(token)
            if not authorized() or self.check()!=approved:raise PermissionError('session_or_permissions_changed')
            ids=result.get('queued')
            if type(ids) is not list or len(ids)!=1:raise PermissionError('manual_queue_response')
            pending=await self.call('security','effects',{'stage':'pending'},request_id=uuid.uuid4().hex);self.check(token)
            items=[item for item in pending.get('commands',[]) if item.get('command_id') in ids]
            if len(items)!=1:raise PermissionError('manual_decision_unavailable')
            if not authorized():raise PermissionError('active_admin_required')
            self.connected=True;self.consent=approved
            await self.deliver(items[0],approved,token)
            return {'delivered':True}
    async def disconnect(self):
        self.connected=False;self.consent=None;self.relay=None
        self.native_at=None
        for listener in tuple(self.native_listeners):listener()
        try:await self.executor(partial(self.client.security_session,{'action':'close'},request_id=uuid.uuid4().hex))
        except Exception:pass
    async def run(self):
        last_status=None;enabled=False
        try:
            while not self.closed:
                try:
                    self.check();now=self.clock()
                    if self.refresh_status or last_status is None or not 0<=(now-last_status).total_seconds()<20:
                        self.refresh_status=False
                        status=await self.call('status');self.check()
                        module=status['modules']['CP-SECURITY']
                        enabled=module.get('paid_confirmed') is True or module.get('phase')=='trial_active';last_status=now
                    if enabled:await self.cycle()
                    elif self.connected and (self.prepared_until is None or now>=self.prepared_until):await self.disconnect()
                except asyncio.CancelledError:raise
                except Exception:
                    self.fault='connection_or_authorization_unavailable';last_status=None;await self.disconnect()
                await asyncio.sleep(2)
        finally:await self.disconnect()
    def start(self,create_task):
        if self.task is not None:raise RuntimeError('edge_already_started')
        self.task=create_task(self.run())
    def close(self):
        self.closed=True;self.connected=False;self.consent=None;self.generation=uuid.uuid4().hex
        self.native_at=None
        for listener in tuple(self.native_listeners):listener()
        if self.task is not None:self.task.cancel()
