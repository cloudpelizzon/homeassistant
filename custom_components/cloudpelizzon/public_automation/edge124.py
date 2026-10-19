"""Public HA transport only: approved state snapshots and signed relay delivery.

The gateway owns rules, schedules, authorization and execution. No local engine.
All synchronous SDK and durable relay work is delegated to the HA executor.
"""
import asyncio,json,re,uuid
from datetime import datetime,timedelta,timezone
from functools import partial

def policy(value):
    if type(value) is not dict or set(value)!={'reads','targets'}:raise ValueError('permission_fields')
    for name,pattern in (('reads',r'[a-z_]+\.[a-z0-9_]+'),('targets',r'(light|switch|input_boolean)\.[a-z0-9_]+')):
        rows=value[name]
        if type(rows) is not list or len(rows)>200 or any(type(e) is not str or not re.fullmatch(pattern,e) for e in rows) or len(set(rows))!=len(rows):raise ValueError('permission_entities')
    return {name:sorted(rows) for name,rows in value.items()}

class Edge:
    def __init__(self,client,*,executor,snapshot,read_policy,save_policy,service,relay_factory,clock=None):
        self.client=client;self.executor=executor;self.snapshot=snapshot
        self.read_policy=read_policy;self.save_policy=save_policy;self.service=service;self.relay_factory=relay_factory
        self.clock=clock or (lambda:datetime.now(timezone.utc));self.closed=False;self.lock=asyncio.Lock()
        self.generation=uuid.uuid4().hex;self.task=None;self.connected=False;self.fault=None;self.relay=None;self.consent=None
        self.refresh_status=True;self.prepared_until=None
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
            if value!=current and (value['reads'] or value['targets']) and confirmed is not True:raise PermissionError('explicit_consent_required')
            token=self.generation=uuid.uuid4().hex;self.connected=False;self.relay=None;self.consent=None
            result=await self.call('worker_session',{'action':'prepare','policy':value,'confirmed':confirmed,**self.feed(value)},request_id=uuid.uuid4().hex)
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
        if domain not in ('light','switch','input_boolean') or name not in ('turn_on','turn_off','toggle'):raise PermissionError('unsupported_service')
        entities=data.get('entity_id');entities=[entities] if type(entities) is str else entities
        if type(entities) is not list or not entities or any(e not in approved['targets'] for e in entities):raise PermissionError('unapproved_target')
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
                result=self.client.effects(args,request_id=rid)
                if args.get('stage')=='confirm':
                    deadline['expires']=min(datetime.fromisoformat(result['expires_at'].replace('Z','+00:00')),
                        datetime.fromisoformat(result['receipt']['claims']['expires_at'].replace('Z','+00:00')))
                return result
            if self.relay is None:self.relay=self.relay_factory(approved['targets'],gateway,service)
            return asyncio.run(self.relay.deliver(descriptor))
        result=await self.executor(run);self.check(token)
        if result.get('outcome')!='success' or result.get('acknowledged') is not True:raise PermissionError('delivery_unconfirmed_no_automatic_retry')
    async def cycle(self):
        async with self.lock:
            approved=self.check();token=self.generation;responses=[]
            for _ in range(16):
                result=await self.call('worker_poll',{**self.feed(approved),'proof_responses':responses},request_id=uuid.uuid4().hex)
                self.check(token)
                if self.check()!=approved or type(result) is not dict or result.get('connected') is not True or type(result.get('proof_requests')) is not list or len(result['proof_requests'])>1 or type(result.get('faults')) is not list:raise PermissionError('poll_response_binding')
                if result['faults']:raise PermissionError('native_execution_fault')
                self.connected=True;self.consent=approved;responses=[]
                for request in result['proof_requests']:
                    if type(request) is not dict or set(request)!={'ticket','args','request_id'}:raise PermissionError('proof_request_binding')
                    packet=await self.call('authorize_native',request['args'],request_id=request['request_id']);self.check(token)
                    responses.append({'ticket':request['ticket'],'receipt':packet['receipt']})
                if not responses:break
            else:raise PermissionError('proof_round_capacity')
            if approved['targets']:
                result=await self.call('effects',{'stage':'pending'},request_id=uuid.uuid4().hex);self.check(token)
                if type(result.get('commands')) is not list or len(result['commands'])>50:raise PermissionError('delivery_response')
                for descriptor in result['commands']:
                    self.check(token)
                    await self.deliver(descriptor,approved,token)
            self.fault=None
    async def disconnect(self):
        self.connected=False;self.consent=None;self.relay=None
        try:await self.executor(partial(self.client.worker_session,{'action':'close'},request_id=uuid.uuid4().hex))
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
                        module=status['modules']['CP-AUTOMATION']
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
        if self.task is not None:self.task.cancel()
