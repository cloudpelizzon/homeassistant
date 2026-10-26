"""Owned local Security kernel behind the existing HA management and event ports.

Installation transfers configuration only. Effect consent belongs to a fresh HA
administrator and the current policy; installation itself grants no device use.
The existing edge supplies bounded native snapshots and the background lifecycle.
"""
import asyncio,json,sqlite3,uuid
from contextlib import closing
from datetime import datetime,timedelta
from functools import partial
if __package__:
 from .private_runtime290 import SecurityRuntime,SECURITY_OPS
 from .module_migrations250 import SECURITY
 from .module_package243 import canonical,sha
 from .module_coordinator253 import completed
 from .local_effects291 import LocalEffects
 from .local_ownership300 import OwnerStore,actor_guard
else:
 from private_runtime290 import SecurityRuntime,SECURITY_OPS
 from module_migrations250 import SECURITY
 from module_package243 import canonical,sha
 from module_coordinator253 import completed
 from local_effects291 import LocalEffects
 from local_ownership300 import OwnerStore,actor_guard

KEY='cloudpelizzon_local_security300'
EDGE='cloudpelizzon_security_connection126'

def need(ok,code):
 if not ok:raise PermissionError(code)

class SecurityAdapter:
 schema=SECURITY
 def __init__(self,hass,spec,operations,*,gate_options=None):
  self.hass=hass;self.spec=spec;self.operations=tuple(operations);self.gate_options=gate_options
 def available(self):
  edge=self.hass.data.get(EDGE)
  return edge is not None and not edge.closed and callable(edge.snapshot)
 async def create(self,candidate,context,pin):
  def create():
   return SecurityRuntime(candidate['packet'],candidate['archive'],client=context['client'],core_id=context['core_id'],
    signer_sha256=pin,allowed_operations=self.operations,database=candidate['database'],
    authority_database=candidate['folder']/'authority.sqlite3',resources=candidate['folder']/('resources-'+uuid.uuid4().hex),
    gate_options=self.gate_options,timezone_name=self.hass.config.time_zone)
  return await completed(self.hass.async_add_executor_job(create))
 async def health(self,runtime,guard):
  guard()
  value=await completed(self.hass.async_add_executor_job(partial(runtime.execute,'security.config.read',
   {'action':'config.read','payload':{}},uuid.uuid4().hex,actor_guard=lambda:not runtime.closed)))
  guard();return type(value) is dict and type(value.get('configuracao')) is dict
 async def attach(self,runtime,ready):
  need(self.available(),'native_security_edge_required')
  route=SecurityRoute(self.hass,self.hass.data[EDGE],runtime,ready)
  try:await route.attach()
  except BaseException:route.close();raise
  return route.close

class SecurityRoute:
 def __init__(self,hass,edge,runtime,ready):
  need(KEY not in hass.data,'security_route_already_owned')
  self.hass=hass;self.edge=edge;self.runtime=runtime;self.ready=ready;self.closed=False
  self.owner=None;self.epoch=uuid.uuid4().hex;self.dispatcher=None;self.feed_at=None
  self.old_call=edge.call;self.old_prepare=edge.prepare;self.old_deliver=edge.deliver;self.old_disconnect=edge.disconnect
  self.call_fn=self.call;self.prepare_fn=self.prepare;self.deliver_fn=self.deliver;self.disconnect_fn=self.disconnect
  self.database=runtime.database.parent/'execution300.sqlite3';self.attached=False
  self.owners=OwnerStore(self.database,runtime.sku,runtime.iid)
 def check(self,*,committed=True):
  need(not self.closed and not self.runtime.closed and self.hass.data.get(KEY) is self
   and not self.edge.closed and (not committed or self.ready() is True),'local_security_not_ready')
 def actor(self):return not self.closed and not self.runtime.closed and self.hass.data.get(KEY) is self and not self.edge.closed
 def save_owner(self,value):
  self.owners.save(value)
 def read_owner(self):
  return self.owners.load()
 def effect_policy(self):
  if not self.actor() or not self.ready() or self.owner is None or self.edge.check()!=self.owner['policy']:return None
  return {'owner_id':self.owner['owner_id'],'generation':self.owner['generation']+self.epoch,'effects':self.owner['policy']['effects']}
 async def active_owner(self):
  value=self.effect_policy();need(value is not None,'security_permissions_confirmation_required')
  user=await self.hass.auth.async_get_user(value['owner_id']);self.check()
  need(user is not None and user.is_active is True and user.is_admin is True and not getattr(user,'system_generated',False),'active_security_owner_required')
  need(self.effect_policy()==value,'security_owner_changed');return user
 async def attach(self):
  # Invalidate the old feed before waiting for its task. It cannot pass its
  # generation check to deliver a command after this boundary.
  self.edge.generation=uuid.uuid4().hex;self.edge.connected=False
  task=self.edge.task
  if task is not None:
   task.cancel()
   try:await task
   except asyncio.CancelledError:pass
  self.edge.task=None
  await completed(self.hass.async_add_executor_job(self.runtime.disconnect))
  self.owner=await completed(self.hass.async_add_executor_job(self.read_owner))
  if self.owner is not None and self.owner['policy']!=self.edge.check():self.owner=None
  self.hass.data[KEY]=self
  self.edge.call=self.call_fn;self.edge.prepare=self.prepare_fn
  self.edge.deliver=self.deliver_fn;self.edge.disconnect=self.disconnect_fn
  self.attached=True
  # A stored policy was explicitly approved locally, not imported from a cloud
  # archive. Re-establish technical feed only; no arm command or queue replay.
  if self.owner is not None:
   user=await self.hass.auth.async_get_user(self.owner['owner_id'])
   if user is None or not user.is_active or not user.is_admin:self.owner=None
   else:
    args={'action':'prepare','policy':self.owner['policy'],'confirmed':True,**self.edge.feed(self.owner['policy'])}
    await completed(self.hass.async_add_executor_job(partial(self.runtime.prepare,args,uuid.uuid4().hex,actor_guard=self.actor)))
  self.edge.refresh_status=True
  self.edge.start(lambda coro:self.hass.async_create_background_task(coro,'CloudPelizzon local Security'))
 async def call(self,name,*args,**kwargs):
  self.check()
  if name=='status':return await self.old_call(name,*args,**kwargs)
  if name=='security_session':
   value=args[0]
   if value.get('action')=='close':
    await completed(self.hass.async_add_executor_job(self.runtime.disconnect));return {'closed':True}
   need(value.get('action')=='prepare','local_security_session_action')
   return await completed(self.hass.async_add_executor_job(partial(self.runtime.prepare,value,kwargs['request_id'],actor_guard=self.actor)))
  need(name=='security' and len(args)==2,'local_security_native_call_required')
  action,payload=args;operation=SECURITY_OPS.get(action)
  need(operation is not None,'local_security_action_required')
  if action in ('feed','manual','native.mode') or action.startswith('alarm.'):await self.active_owner()
  if action in ('config.write','engines.update'):
   self.epoch=uuid.uuid4().hex
   if self.dispatcher:self.dispatcher.close();self.dispatcher=None
  result=await completed(self.hass.async_add_executor_job(partial(self.runtime.execute,operation,
   {'action':action,'payload':payload},kwargs['request_id'],actor_guard=self.actor)))
  self.check()
  if action=='feed':self.feed_at=datetime.fromisoformat(payload['sampled_at'].replace('Z','+00:00'))
  if action in ('engines.read','engines.update') and type(result.get('global')) is dict:
   result['global']['execution']='signed_local_runtime'
  return result
 async def request(self,action,payload,rid):return await self.call('security',action,payload,request_id=rid)
 def request_sync(self,action,payload,rid):
  # Configuration HTTP/service APIs already perform native HA user checks on
  # either side of their executor call. Physical delivery has separate ownership.
  self.check();operation=SECURITY_OPS.get(action);need(operation is not None,'local_security_action_required')
  if action in ('config.write','engines.update'):
   self.epoch=uuid.uuid4().hex
   if self.dispatcher:self.dispatcher.close();self.dispatcher=None
  result=self.runtime.execute(operation,{'action':action,'payload':payload},rid,actor_guard=self.actor)
  self.check();return result
 async def prepare(self,*,new_policy=None,confirmed=False,authorized=lambda:True):
  self.check()
  owner_id=getattr(authorized,'actor_id',None)
  if confirmed is True:
   need(type(owner_id) is str and authorized() is True,'authenticated_security_policy_owner_required')
   user=await self.hass.auth.async_get_user(owner_id);self.check()
   need(user is not None and user.is_active and user.is_admin and authorized() is True,'active_security_policy_owner_required')
  else:await self.active_owner()
  value=await self.old_prepare(new_policy=new_policy,confirmed=confirmed,authorized=authorized)
  self.check();need(authorized() is True,'security_policy_actor_changed')
  if confirmed is True:
   value={'owner_id':owner_id,'generation':uuid.uuid4().hex,'policy':self.edge.check()}
   self.owner=None
   try:await completed(self.hass.async_add_executor_job(self.save_owner,value))
   except BaseException:self.owner=None;await self.disconnect();raise
   self.owner=value
   if self.dispatcher:self.dispatcher.close();self.dispatcher=None
  return value
 async def deliver(self,descriptor,approved,token):
  self.check();self.edge.check(token);await self.active_owner()
  need(self.effect_policy()['effects']==approved['effects'],'security_delivery_policy_changed')
  cid=descriptor['command_id'];command=descriptor['command']
  lease=await self.request('effects',{'stage':'claim','command_id':cid,'command_sha256':sha(canonical(command))},uuid.uuid4().hex)
  confirmed=await self.request('effects',{'stage':'confirm','command_id':cid,'lease_id':lease['lease_id'],'command':command},uuid.uuid4().hex)
  need(confirmed['command']==command,'security_delivery_command_changed')
  expires=datetime.fromisoformat(confirmed['expires_at'].replace('Z','+00:00'))
  need(self.feed_at is not None,'fresh_local_security_feed_required')
  expires=min(expires,self.feed_at+timedelta(seconds=5))
  if self.dispatcher is None:
   value=self.effect_policy()
   self.dispatcher=LocalEffects(self.hass,self.runtime,owner_id=value['owner_id'],generation=value['generation'],effects=value['effects'],
    current_policy=self.effect_policy,database=self.database)
  result=await self.dispatcher.dispatch(command,deadline=expires)
  outcome='success' if result['state']=='service_completed' else 'uncertain'
  await self.request('effects',{'stage':'ack','command_id':cid,'lease_id':lease['lease_id'],'outcome':outcome},uuid.uuid4().hex)
  need(outcome=='success','security_delivery_uncertain_no_retry')
 async def disconnect(self):
  self.edge.connected=False;self.edge.consent=None;self.edge.relay=None;self.edge.native_at=None
  self.epoch=uuid.uuid4().hex;self.feed_at=None
  if self.dispatcher:self.dispatcher.close();self.dispatcher=None
  for listener in tuple(self.edge.native_listeners):listener()
  await completed(self.hass.async_add_executor_job(self.runtime.disconnect))
 def close(self):
  if self.closed:return
  self.closed=True;self.epoch=uuid.uuid4().hex
  if self.dispatcher:self.dispatcher.close()
  if self.attached:
   self.edge.generation=uuid.uuid4().hex;self.edge.connected=False;self.edge.consent=None;self.edge.native_at=None
   if self.edge.task is not None:self.edge.task.cancel()
   # Do not restart an obsolete cloud owner from a synchronous detach callback.
   # Component reload recreates the original Trial lifecycle when appropriate.
   if self.edge.call is self.call_fn:self.edge.call=self.old_call
   if self.edge.prepare is self.prepare_fn:self.edge.prepare=self.old_prepare
   if self.edge.deliver is self.deliver_fn:self.edge.deliver=self.old_deliver
   if self.edge.disconnect is self.disconnect_fn:self.edge.disconnect=self.old_disconnect
  if self.hass.data.get(KEY) is self:self.hass.data.pop(KEY)
