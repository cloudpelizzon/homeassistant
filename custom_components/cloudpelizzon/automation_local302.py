"""Native Automation planner isolated from HA's real service registry.

Rules, validation, triggers and scripts come from the signed private package.
The auxiliary HA receives only approved state/event inputs. Physical calls cross
the same paid receipt, local owner and durable effect ledger used by Security.
"""
import asyncio,json,re,sqlite3,uuid
from contextlib import closing
from datetime import datetime
from functools import partial
from pathlib import Path
if __package__:
 from .private_runtime290 import AutomationRuntime
 from .module_migrations250 import AUTOMATION
 from .module_package243 import canonical,sha
 from .module_coordinator253 import completed
 from .local_effects291 import LocalEffects
 from .local_ownership300 import OwnerStore
 from .tenant_migration246 import safe
else:
 from private_runtime290 import AutomationRuntime
 from module_migrations250 import AUTOMATION
 from module_package243 import canonical,sha
 from module_coordinator253 import completed
 from local_effects291 import LocalEffects
 from local_ownership300 import OwnerStore
 from tenant_migration246 import safe

KEY='cloudpelizzon_local_automation302';UI='cloudpelizzon_automation76'

def need(ok,code):
 if not ok:raise PermissionError(code)

class AutomationAdapter:
 schema=AUTOMATION
 def __init__(self,hass,spec,operations,*,gate_options=None):
  self.hass=hass;self.spec=spec;self.operations=tuple(operations);self.gate_options=gate_options
 def available(self):
  bridge=self.hass.data.get(UI)
  return bridge is not None and not bridge.closed and hasattr(bridge,'edge') and not bridge.edge.closed
 async def create(self,candidate,context,pin):
  loop=asyncio.get_running_loop();holder={}
  async def validator(rule):
   async def native():return await holder['runtime'].namespace.load('native_validation85.py').NativeValidator(self.hass)(rule)
   # The configuration service and its SQLite work run on an executor loop;
   # native HA validation remains on the real HA event loop.
   return await asyncio.wrap_future(asyncio.run_coroutine_threadsafe(native(),loop))
  def create():
   runtime=AutomationRuntime(candidate['packet'],candidate['archive'],client=context['client'],core_id=context['core_id'],
    signer_sha256=pin,allowed_operations=self.operations,database=candidate['database'],authority_database=candidate['folder']/'authority.sqlite3',
    resources=candidate['folder']/('resources-'+uuid.uuid4().hex),gate_options=self.gate_options,validator=validator)
   holder['runtime']=runtime;return runtime
  return await completed(self.hass.async_add_executor_job(create))
 async def health(self,runtime,guard):
  guard()
  def read():return asyncio.run(runtime.service.execute(runtime.iid,'automation.rules.read',{},uuid.uuid4().hex))
  value=await completed(self.hass.async_add_executor_job(read));guard()
  return type(value) is dict and type(value.get('rules')) is list and value.get('execution_available') is False
 async def attach(self,runtime,ready):
  need(self.available(),'native_automation_UI_required')
  route=AutomationRoute(self.hass,self.hass.data[UI],runtime,ready)
  try:await route.attach()
  except BaseException:route.close();raise
  return route.close

class AutomationRoute:
 def __init__(self,hass,bridge,runtime,ready,*,engine_factory=None,policy_validator=None):
  need(KEY not in hass.data,'automation_route_already_owned')
  self.hass=hass;self.bridge=bridge;self.edge=bridge.edge;self.runtime=runtime;self.ready=ready;self.closed=False
  self.lock=asyncio.Lock();self.owner=None;self.engine=None;self.dispatcher=None;self.feed_at=None;self.bindings={};self.listeners={};self.events={}
  self.database=runtime.database.parent/'execution300.sqlite3';self.owners=OwnerStore(self.database,runtime.sku,runtime.iid)
  self.engine_factory=engine_factory;self.policy_validator=policy_validator;self.resume_needed=True;self.epoch=uuid.uuid4().hex
  self.old_execute=bridge.execute;self.old_cycle=self.edge.cycle;self.old_prepare=self.edge.prepare;self.old_disconnect=self.edge.disconnect
  self.execute_fn=self.execute;self.cycle_fn=self.cycle;self.prepare_fn=self.prepare;self.disconnect_fn=self.disconnect
  self.attached=False
 def check(self,*,committed=True):
  need(not self.closed and not self.runtime.closed and not self.edge.closed and self.hass.data.get(KEY) is self
   and (not committed or self.ready() is True),'local_automation_not_ready')
 def effect_policy(self):
  if self.closed or self.runtime.closed or not self.ready() or self.owner is None or self.owner['policy']!=self.edge.check():return None
  safe=self.runtime.namespace.load('cloudpelizzon_relay/protocol.py').SAFE
  effects=sorted([*service.split('.'),eid] for eid in self.owner['policy']['targets'] for service in safe if service.split('.')[0]==eid.split('.')[0])
  return {'owner_id':self.owner['owner_id'],'generation':self.owner['generation']+self.epoch,'effects':effects}
 async def active_owner(self):
  self.check();value=self.effect_policy();need(value is not None,'automation_permissions_confirmation_required')
  user=await self.hass.auth.async_get_user(value['owner_id']);self.check()
  need(user is not None and user.is_active and user.is_admin and not getattr(user,'system_generated',False),'active_automation_owner_required')
  need(value==self.effect_policy(),'automation_owner_changed');return user
 async def attach(self):
  self.edge.generation=uuid.uuid4().hex;self.edge.connected=False
  task=self.edge.task
  if task is not None:
   task.cancel()
   try:await task
   except asyncio.CancelledError:pass
  self.edge.task=None
  self.owner=await completed(self.hass.async_add_executor_job(self.owners.load))
  if self.owner is not None and self.owner['policy']!=self.edge.check():self.owner=None
  self.hass.data[KEY]=self
  self.bridge.execute=self.execute_fn;self.edge.cycle=self.cycle_fn;self.edge.prepare=self.prepare_fn;self.edge.disconnect=self.disconnect_fn
  self.attached=True;self.edge.refresh_status=True
  self.edge.start(lambda coro:self.hass.async_create_background_task(coro,'CloudPelizzon local Automation'))
 async def service(self,operation,args,rid):
  def call():return asyncio.run(self.runtime.service.execute(self.runtime.iid,operation,args,rid))
  return await completed(self.hass.async_add_executor_job(call))
 def intent(self,code,revision=0,generation=0,enabled=False):
  safe(self.database)
  with closing(sqlite3.connect(self.database)) as db,db:
   db.execute('CREATE TABLE IF NOT EXISTS local_rule_activation302(iid TEXT,code TEXT,revision INTEGER,generation INTEGER,owner_generation TEXT,enabled INTEGER,PRIMARY KEY(iid,code))')
   db.execute('INSERT OR REPLACE INTO local_rule_activation302 VALUES(?,?,?,?,?,?)',
    (self.runtime.iid,code,revision,generation,self.owner['generation'] if self.owner else '',int(enabled)))
 def resumable(self):
  safe(self.database)
  with closing(sqlite3.connect(self.database)) as db:
   if not db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='local_rule_activation302'").fetchone():return []
   need(not db.execute('SELECT 1 FROM local_rule_activation302 WHERE iid<>? OR iid IS NULL',(self.runtime.iid,)).fetchone(),'local_automation_activation_scope')
   return db.execute('SELECT code,revision,generation FROM local_rule_activation302 WHERE iid=? AND owner_generation=? AND enabled=1',
    (self.runtime.iid,self.owner['generation'])).fetchall()
 async def authorize(self,iid,operation,args,rid):
  self.check();await self.active_owner()
  need(iid==self.runtime.iid and operation in ('automation.rules.activate','automation.rules.execute'),'local_native_authorization_binding')
  need(self.feed_at is not None and 0<=(self.edge.clock()-self.feed_at).total_seconds()<5,'fresh_local_automation_feed_required')
  if operation=='automation.rules.execute':
   code=args.get('code') or args.get('command',{}).get('code')
   binding=self.bindings.get(code)
   revision=args.get('revision',args.get('command',{}).get('revision'))
   need(binding is not None and args.get('activation_generation')==binding[1] and revision==binding[0],'committed_native_activation_required')
  policy=self.effect_policy()
  bound={'native':args,'owner_id':policy['owner_id'],'policy_sha256':sha(canonical(policy))}
  await completed(self.hass.async_add_executor_job(self.runtime.gate.authorize,iid,operation,bound,rid))
  self.check();await self.active_owner();need(policy==self.effect_policy(),'automation_policy_changed')
  need(self.feed_at is not None and 0<=(self.edge.clock()-self.feed_at).total_seconds()<5,'fresh_local_automation_feed_required')
  if operation=='automation.rules.execute':need(self.bindings.get(code)==binding,'native_activation_changed_during_authorization')
  return True
 async def relay(self,command):
  await self.active_owner()
  code=command['code'];binding=self.bindings.get(code)
  need(binding is not None and binding[0]==command['revision'],'active_native_command_binding_required')
  value=self.effect_policy()
  def current():
   if self.bindings.get(code)!=binding or self.feed_at is None or not 0<=(self.edge.clock()-self.feed_at).total_seconds()<5:return None
   return self.effect_policy()
  dispatcher=LocalEffects(self.hass,self.runtime,owner_id=value['owner_id'],generation=value['generation'],
   effects=value['effects'],current_policy=current,database=self.database)
  try:return (await dispatcher.dispatch(command))['state']=='service_completed'
  finally:dispatcher.close()
 async def ensure_engine(self):
  if self.engine is not None:return
  await self.active_owner();folder=self.runtime.database.parent/'native302'
  def prepare():folder.mkdir(mode=0o700,exist_ok=True);return folder
  folder=await completed(self.hass.async_add_executor_job(prepare))
  factory=self.engine_factory or self.runtime.namespace.load('native_engine85.py').PrivateEngine.create
  owned={}
  async def create():
   engine=await factory(self.runtime.iid,folder,allowed_entities=set(self.owner['policy']['targets']),authorizer=self.authorize,relay=self.relay)
   owned['engine']=engine;return engine
  try:
   engine=await completed(create());self.check();await self.active_owner();self.engine=engine
  except BaseException:
   if owned.get('engine') is not None:await completed(owned['engine'].close())
   raise
 async def feed(self):
  await self.active_owner();policy=self.edge.check();snapshot=self.edge.feed(policy)
  bound={'local_snapshot':snapshot,'policy':policy,'owner_id':self.owner['owner_id']}
  await completed(self.hass.async_add_executor_job(self.runtime.gate.authorize,self.runtime.iid,'automation.rules.read',bound,uuid.uuid4().hex))
  self.check();await self.active_owner();need(policy==self.edge.check(),'automation_snapshot_policy_changed')
  # Reject a slow authorization rather than relabel an old sample as fresh.
  stamp=datetime.fromisoformat(snapshot['sampled_at'].replace('Z','+00:00'))
  need(0<=(self.edge.clock()-stamp).total_seconds()<5,'stale_local_automation_snapshot')
  self.feed_at=stamp
  await self.ensure_engine()
  current=set(snapshot['states'])
  for eid in list(self.engine.hass.states.async_entity_ids()):
   if eid not in current:self.engine.hass.states.async_remove(eid)
  for eid,row in snapshot['states'].items():self.engine.hass.states.async_set(eid,row['state'],row['attributes'])
  self.edge.connected=True;self.edge.consent=policy;self.edge.fault=None
 def event_types(self,rule):
  events=set()
  for trigger in rule['triggers']:
   kind=trigger.get('trigger',trigger.get('platform'))
   if kind=='event':
    event=trigger.get('event_type')
    need(type(event) is str and re.fullmatch('[a-zA-Z0-9_]{1,64}',event),'static_local_event_type_required')
    if event=='state_changed':continue # Generated only from approved auxiliary states.
    need(event not in ('call_service','service_registered','service_removed'),'reserved_local_event_denied');events.add(event)
   elif kind=='homeassistant':events.add('homeassistant_started' if trigger.get('event')=='start' else 'homeassistant_stop')
  return events
 def unsubscribe(self,code):
  for event_type in self.listeners.pop(code,set()):
   event=self.events.get(event_type)
   if event is not None:
    event['codes'].discard(code)
    if not event['codes']:event['remove']();self.events.pop(event_type)
 def subscribe(self,code,rule):
  self.unsubscribe(code);subscribed=set()
  for event_type in self.event_types(rule):
   if event_type not in self.events:
    async def forward(event):
     try:
      self.check();await self.active_owner()
      need(self.feed_at is not None and 0<=(self.edge.clock()-self.feed_at).total_seconds()<5,'local_event_feed_stale')
      subscription=self.events.get(event.event_type)
      need(subscription is not None and subscription['codes'] & self.bindings.keys() and self.engine is not None,'local_event_rule_inactive')
      data=json.loads(canonical(dict(event.data)));need(len(canonical(data))<=32768,'bounded_local_event_required')
      self.engine.hass.bus.async_fire(event.event_type,data)
     except Exception:return
    self.events[event_type]={'codes':set(),'remove':self.hass.bus.async_listen(event_type,forward)}
   self.events[event_type]['codes'].add(code);subscribed.add(event_type)
  self.listeners[code]=subscribed
 async def activate(self,code,revision,generation,rule):
  self.event_types(rule);await self.feed()
  if code in self.engine.active:await completed(self.engine.deactivate(code))
  self.bindings.pop(code,None)
  await completed(self.hass.async_add_executor_job(self.intent,code,revision,generation,False))
  self.engine.put(code,rule,revision,generation)
  try:
   await completed(self.engine.activate(code,ack=True))
   self.check();await self.active_owner()
   await completed(self.hass.async_add_executor_job(self.intent,code,revision,generation,True))
   self.bindings[code]=(revision,generation);self.subscribe(code,rule)
  except BaseException:
   self.bindings.pop(code,None);await completed(self.engine.deactivate(code));raise
 async def execute(self,operation,args):
  async with self.lock:
   self.check();args=json.loads(canonical(args));code=args.get('code')
   if operation in ('automation.rules.deactivate','automation.rules.save','automation.rules.delete'):
    need(type(code) is str and re.fullmatch('CUS-[0-9]{8}',code) is not None
     and type(args.get('revision')) is int and args['revision']>0,'valid_local_automation_rule_required')
    await completed(self.hass.async_add_executor_job(self.intent,code))
    self.bindings.pop(code,None)
    self.unsubscribe(code)
    if self.engine is not None:await completed(self.engine.deactivate(code))
   if operation=='automation.rules.activate':
    await self.active_owner();await self.feed()
    selected=await self.service('automation.rules.read',{'code':code},uuid.uuid4().hex)
    need(selected['revision']==args['revision'],'local_automation_rule_revision_changed');self.event_types(selected['rule'])
   result=await self.service(operation,args,uuid.uuid4().hex);self.check()
   if operation=='automation.rules.activate':
    need(result.get('active') is True and result['revision']==args['revision'],'native_activation_intent_required')
    await self.activate(code,result['revision'],result['activation_generation'],selected['rule'])
    result['persistent_executor_connected']=True
   if operation=='automation.rules.read':
    if code:result['active']=code in self.bindings
    else:
     for row in result['rules']:row['active']=row['code'] in self.bindings
   return result
 async def prepare(self,*,new_policy=None,confirmed=False,authorized=lambda:True):
  async with self.lock:
   self.check();need(authorized() is True,'active_automation_admin_required')
   if new_policy is None:value=self.edge.check()
   else:
    if self.policy_validator is None:
     from .public_automation.edge124 import policy
     validator=policy
    else:validator=self.policy_validator
    value=validator(new_policy)
   if confirmed is True:
    uid=getattr(authorized,'actor_id',None);need(type(uid) is str,'authenticated_automation_policy_owner_required')
    user=await self.hass.auth.async_get_user(uid)
    need(user is not None and user.is_active and user.is_admin and authorized() is True,'active_automation_policy_owner_required')
    self.owner=None;await self.stop_engine()
    owner={'owner_id':uid,'generation':uuid.uuid4().hex,'policy':value}
    if new_policy is not None:self.edge.save_policy(value)
    await completed(self.hass.async_add_executor_job(self.owners.save,owner));self.check()
    need(authorized() is True,'automation_policy_actor_changed');self.owner=owner;self.resume_needed=False
   else:
    await self.active_owner();need(value==self.owner['policy'],'explicit_automation_policy_consent_required')
   await self.feed();need(authorized() is True,'automation_policy_actor_changed')
   return {'prepared':True,'policy':value,'trial_started':False}
 async def cycle(self):
  async with self.lock:
   self.check();await self.feed()
   if self.resume_needed:
    rows=await completed(self.hass.async_add_executor_job(self.resumable))
    for code,revision,generation in rows:
     selected=await self.service('automation.rules.read',{'code':code},uuid.uuid4().hex)
     if selected['revision']!=revision or selected.get('active') is not True:continue
     await self.activate(code,revision,generation,selected['rule'])
    self.resume_needed=False
 async def stop_engine(self):
  self.epoch=uuid.uuid4().hex;self.feed_at=None;self.bindings={}
  for event in self.events.values():event['remove']()
  self.listeners={};self.events={}
  if self.dispatcher:self.dispatcher.close();self.dispatcher=None
  engine=self.engine;self.engine=None
  if engine is not None:await completed(engine.close())
 async def disconnect(self):
  self.edge.connected=False;self.edge.consent=None;self.resume_needed=True
  await self.stop_engine()
 def close(self):
  if self.closed:return
  self.closed=True;self.bindings={};self.feed_at=None
  if self.dispatcher:self.dispatcher.close()
  for event in self.events.values():event['remove']()
  self.listeners={};self.events={}
  if self.attached:
   self.edge.generation=uuid.uuid4().hex;self.edge.connected=False;self.edge.consent=None
   if self.edge.task is not None:self.edge.task.cancel()
   if self.bridge.execute is self.execute_fn:self.bridge.execute=self.old_execute
   if self.edge.cycle is self.cycle_fn:self.edge.cycle=self.old_cycle
   if self.edge.prepare is self.prepare_fn:self.edge.prepare=self.old_prepare
   if self.edge.disconnect is self.disconnect_fn:self.edge.disconnect=self.old_disconnect
  if self.hass.data.get(KEY) is self:self.hass.data.pop(KEY)
  engine=self.engine;self.engine=None
  if engine is not None:self.hass.async_create_task(engine.close())
