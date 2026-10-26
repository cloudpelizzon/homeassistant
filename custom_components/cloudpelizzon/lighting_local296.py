"""Bind the verified paid Lighting configuration engine to existing HA UI ports.

Inventory and actor identity come from HA's authenticated connection. The module
receipt grants commercial access; HA's native control ACL grants device control.
Existing Trial ports are restored on detach, without creating a Trial fallback.
"""
import asyncio,json,sqlite3,uuid
from contextlib import closing
from contextvars import ContextVar
from datetime import datetime
if __package__:
 from .private_runtime290 import LightingRuntime
 from .module_migrations250 import LIGHTING
 from .module_package243 import canonical
 from .module_coordinator253 import completed
else:
 from private_runtime290 import LightingRuntime
 from module_migrations250 import LIGHTING
 from module_package243 import canonical
 from module_coordinator253 import completed

KEY='cloudpelizzon_local_lighting296';TRANSPORT='cloudpelizzon_lighting_native_v1'
def need(ok,code):
 if not ok:raise PermissionError(code)

class LightingAdapter:
 schema=LIGHTING
 def __init__(self,hass,spec,operations,*,gate_options=None):
  self.hass=hass;self.spec=spec;self.operations=tuple(operations);self.gate_options=gate_options
 def available(self):
  t=self.hass.data.get(TRANSPORT)
  return t is not None and not t.closed and t.port.registration_ready() is True and t.uplink is not None
 async def create(self,candidate,context,pin):
  def build():return LightingRuntime(candidate['packet'],candidate['archive'],client=context['client'],core_id=context['core_id'],signer_sha256=pin,allowed_operations=self.operations,database=candidate['database'],authority_database=candidate['folder']/'authority.sqlite3',resources=candidate['folder']/('resources-'+uuid.uuid4().hex),gate_options=self.gate_options)
  return await completed(self.hass.async_add_executor_job(build))
 async def health(self,runtime,guard):
  guard()
  def read():return runtime.execute('cp_internal_health','lighting.config.read',{'offset':0,'limit':100},uuid.uuid4().hex,actor_guard=lambda:not runtime.closed)
  value=await completed(self.hass.async_add_executor_job(read));guard()
  return (type(value) is dict and set(value)=={'revision','rooms','items','total','preferences'} and type(value['revision']) is int and type(value['items']) is list and type(value['rooms']) is list and type(value['total']) is int)
 async def attach(self,runtime,ready):
  need(self.available(),'native_lighting_transport_required')
  route=LocalLightingRoute(self.hass,self.hass.data[TRANSPORT],runtime,ready)
  return route.close

class LocalLightingRoute:
 def __init__(self,hass,transport,runtime,ready):
  need(KEY not in hass.data,'lighting_local_route_already_owned')
  self.hass=hass;self.transport=transport;self.runtime=runtime;self.ready=ready;self.closed=False
  self.context=ContextVar('cp_local_lighting296_'+uuid.uuid4().hex,default=None)
  self.port=transport.port;self.old_scope=transport.scope
  self.old_run=transport.run;self.old_current=transport._current
  self.old_execute=self.port.execute;self.old_page=self.port.read_page;self.old_prepare=transport.uplink.prepare
  scope=type(self.old_scope)(installation_id=self.port.installation_id,issue_grant=self.port.issue_grant,read_page=self.read_page,state_get=self.port.state_get)
  self.scope=scope;native_snapshot=scope.snapshot
  async def snapshot(connection):
   token=self.context.set((connection,connection.user))
   try:self.check();return await native_snapshot(connection)
   finally:self.context.reset(token)
  self.snapshot=snapshot;scope.snapshot=snapshot
  # Store bound method objects so detach can preserve another owner's changes.
  self.current_fn=self.capture;self.run_fn=self.run;self.execute_fn=self.execute;self.page_fn=self.read_page;self.prepare_fn=self.prepare
  self.port.execute=self.execute_fn;self.port.read_page=self.page_fn
  transport._current=self.current_fn;transport.run=self.run_fn;transport.uplink.prepare=self.prepare_fn;transport.scope=scope
  hass.data[KEY]=self
 def matches(self,iid):
  return (not self.closed and not self.runtime.closed and self.ready() is True and self.hass.data.get(KEY) is self
   and self.hass.data.get(TRANSPORT) is self.transport and not self.transport.closed and iid==self.runtime.iid==self.port.installation_id())
 def check(self):need(self.matches(self.runtime.iid),'verified_local_lighting_required')
 def connection(self,actor):
  self.check();value=self.context.get();need(value is not None,'authenticated_lighting_context_required')
  connection,user=value
  need(connection.user is user and not getattr(connection,'closed',False) and user.id==actor and user.is_active and not getattr(user,'system_generated',False),'authenticated_lighting_actor_required')
  return connection,user
 async def capture(self,connection,user):
  current=await self.old_current(connection,user);self.check();self.context.set((connection,user));return current
 async def run(self,connection,msg):
  token=self.context.set((connection,connection.user))
  try:self.check();return await self.old_run(connection,msg)
  finally:self.context.reset(token)
 async def prepare(self,connection,iid,actor,rid,*,target_entity_id=None):
  need(iid==self.runtime.iid,'lighting_inventory_identity_required')
  current=await self.capture(connection,connection.user);need(current.id==actor,'lighting_inventory_actor_required')
  # The native inventory collector applies consent and HA read permissions.
  rows=await self.transport.uplink.inventory.collect(connection)
  await self.capture(connection,connection.user)
  if target_entity_id is not None:need(any(row['entity_id']==target_entity_id for row in rows),'scoped_lighting_entity_required')
  return True
 async def read_page(self,iid,actor,parameters,rid):return await self.execute(iid,actor,'lighting.config.read',parameters,rid)
 async def execute(self,iid,actor,operation,parameters,rid):
  need(iid==self.runtime.iid and operation in self.runtime.manifest['operations'],'local_lighting_scope_required')
  connection,user=self.connection(actor);current=await self.old_current(connection,user);self.check()
  if operation not in ('lighting.config.read','lighting.entities.discover','lighting.preferences.write'):need(current.is_admin is True,'lighting_configuration_admin_required')
  rows=[]
  if operation in ('lighting.entities.discover','lighting.entity.bind'):
   rows=await self.transport.uplink.inventory.collect(connection)
   current=await self.old_current(connection,user);self.check()
  def guard():
   return self.matches(iid) and connection.user is user and not getattr(connection,'closed',False) and user.is_active and current.is_active and not getattr(current,'system_generated',False)
  def call():return self.runtime.execute(actor,operation,parameters,rid,inventory=rows,actor_guard=guard)
  result=await completed(self.hass.async_add_executor_job(call))
  await self.old_current(connection,user);self.check();return result
 async def authorize_native_control(self,connection,user,iid,eid,action,rid):
  self.check();need(iid==self.runtime.iid and action in ('turn_on','turn_off'),'lighting_HA_control_binding_required')
  current=await self.old_current(connection,user);self.check()
  def guard():return self.matches(iid) and connection.user is user and not getattr(connection,'closed',False) and user.is_active and current.is_active
  def check_access():
   with self.runtime.lock:
    need(guard(),'active_lighting_control_actor_required')
    # This receipt authorizes paid module access, not a cloud actuator grant.
    claims=self.runtime.gate.authorize(iid,'lighting.config.read',{'actor_id':user.id,'parameters':{'offset':0,'limit':100},'HA_native_control_context':{'entity_id':eid,'action':action}},rid)
    need(guard(),'active_lighting_control_actor_required')
    with closing(sqlite3.connect(self.runtime.database)) as db:
     row=db.execute('SELECT document FROM config WHERE iid=?',(iid,)).fetchone()
    item=json.loads(row[0])['entities'].get(eid) if row else None
    need(item is not None and item.get('kind')=='light' and item.get('visible') is True,'local_mapped_visible_light_required')
    return datetime.fromisoformat(claims['expires_at'].replace('Z','+00:00'))
  expires=await completed(self.hass.async_add_executor_job(check_access));await self.old_current(connection,user);self.check();return expires
 def control_current(self,expires):return self.matches(self.runtime.iid) and self.runtime.gate.clock()<expires
 def close(self):
  if self.closed:return
  self.closed=True
  if self.port.execute is self.execute_fn:self.port.execute=self.old_execute
  if self.port.read_page is self.page_fn:self.port.read_page=self.old_page
  if self.transport.run is self.run_fn:self.transport.run=self.old_run
  if self.transport._current is self.current_fn:self.transport._current=self.old_current
  if self.transport.uplink.prepare is self.prepare_fn:self.transport.uplink.prepare=self.old_prepare
  if self.transport.scope is self.scope:self.transport.scope=self.old_scope
  if self.hass.data.get(KEY) is self:self.hass.data.pop(KEY)
