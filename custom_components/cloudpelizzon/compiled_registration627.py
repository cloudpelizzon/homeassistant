"""Composition hook for the existing CloudPelizzon HA integration.

Call after native public UI ports are registered, instead of restoring plaintext
engines. The application public-key pin is injected from reviewed release code;
never trust a key supplied by the local installation marker itself.
"""
import asyncio,json,os,uuid
from functools import partial
from pathlib import Path
from .compiled_activation627 import recover_pending
from .compiled_loader627 import safe,ENTRIES
from .compiled_runtime627 import Runtime,LightingRuntime,AutomationRuntime,SecurityRuntime,LocalSDK

class Registration:
 def __init__(self,hass,context,root,public_key,*,allow_test=False):
  self.hass=hass;self.context=context;self.root=safe(root);self.public_key=public_key
  self.allow_test=allow_test;self.runtimes={};self.closers=[];self.closed=False
 def ready(self,sku):return not self.closed and sku in self.runtimes and not self.runtimes[sku].closed
 async def load(self):
  def read():
   recover_pending(self.root)
   identity=json.loads((self.root/'identity.json').read_bytes())
   if identity!={'core_id':self.context['core_id'],'installation_id':self.context['trial_id']}:raise PermissionError('HA_compiled_identity_changed')
   marker=json.loads((self.root/'installed627.json').read_bytes())
   if marker['schema']!='cp.native.installed627.v1' or not set(marker['modules'])<=set(ENTRIES):raise PermissionError('HA_compiled_marker')
   data=json.loads((self.root/'data627.json').read_bytes())
   return {sku:row for sku,row in marker['modules'].items() if sku!='CP-FINANCE'},data
  modules,data=await self.hass.async_add_executor_job(read)
  expected=str(self.root)
  current=os.environ.setdefault('CP_COMPILED_HOME627',expected)
  if current!=expected:raise PermissionError('one_compiled_identity_per_HA_process')
  try:
   for sku,row in modules.items():
    if sku=='CP-INVENTORY':continue
    if row['public_key']!=self.public_key:raise PermissionError('release_issuer_pin_changed')
    db=safe(data[sku]['database'])
    if data[sku]['core_id']!=self.context['core_id'] or data[sku]['installation_id']!=self.context['trial_id']:raise PermissionError('migration_tenant_changed')
    if not db.is_file():raise PermissionError('verified_data_migration_required')
    typ={'CP-LIGHTING':LightingRuntime,'CP-AUTOMATION':AutomationRuntime,'CP-SECURITY':SecurityRuntime}.get(sku,Runtime)
    runtime=await self.hass.async_add_executor_job(partial(typ,row['folder'],sku=sku,public_key=self.public_key,state_root=self.root,iid=self.context['trial_id'],core_id=self.context['core_id'],database=db,allow_test=self.allow_test,timezone_name=self.hass.config.time_zone))
    self.runtimes[sku]=runtime
    if sku=='CP-AUTOMATION':
     module=await self.hass.async_add_executor_job(runtime.namespace.load,'native_validation85.py');validator=module.NativeValidator(self.hass)
     async def validate(rule,validator=validator):
      return await asyncio.wrap_future(asyncio.run_coroutine_threadsafe(validator(rule),self.hass.loop))
     await self.hass.async_add_executor_job(runtime.configure_validator,validate)
   return modules
  except BaseException:self.close();raise
 async def attach(self,entry,modules):
  """Reuse original UI routes and their HA actor/consent/generation guards."""
  status_runtimes=dict(self.runtimes)
  try:
   for sku,runtime in self.runtimes.items():
    ready=partial(self.ready,sku)
    if sku=='CP-LIGHTING':
     from .lighting_local296 import LocalLightingRoute,TRANSPORT
     transport=self.hass.data[TRANSPORT];port=transport.port;old=port.issue_grant
     async def local_grant(iid,actor,operation,runtime=runtime):
      await self.hass.async_add_executor_job(runtime.gate.authorize,iid,operation,{'actor_id':actor},uuid.uuid4().hex)
      return {'sku':'CP-LIGHTING','gateway_verified':True,'license':{'allowed':True}}
     port.issue_grant=local_grant
     self.closers.append(lambda port=port,old=old,fn=local_grant:setattr(port,'issue_grant',old) if port.issue_grant is fn else None)
     route=LocalLightingRoute(self.hass,transport,runtime,ready);self.closers.append(route.close)
    elif sku=='CP-AUTOMATION':
     from .automation_local302 import AutomationRoute
     from .public_automation.api import KEY
     route=AutomationRoute(self.hass,self.hass.data[KEY],runtime,ready)
     self.closers.append(route.close);await route.attach()
    elif sku=='CP-SECURITY':
     from .security_local300 import SecurityRoute,EDGE
     route=SecurityRoute(self.hass,self.hass.data[EDGE],runtime,ready)
     self.closers.append(route.close);await route.attach()
    else:
     key='maintenance' if sku=='CP-MAINTENANCE' else 'energy'
     state=self.hass.data['cloudpelizzon'][key]
     rows=[state['remote_controller']] if 'remote_controller' in state else [v['remote_controller'] for v in state.values() if isinstance(v,dict) and 'remote_controller' in v]
     if len(rows)!=1 or rows[0].iid!=runtime.iid:raise PermissionError('matching_native_controller_required')
     client=rows[0].client;old=client.execute
     def execute(requested,operation,args=None,request_id=None,*,runtime=runtime,old=old):
      if requested==runtime.sku:return runtime.execute(operation,args or {},request_id or uuid.uuid4().hex)
      return old(requested,operation,args,request_id=request_id)
     client.execute=execute
     self.closers.append(lambda client=client,old=old,fn=execute:setattr(client,'execute',old) if client.execute is fn else None)
     if sku=='CP-SOLAR':
      from types import MethodType
      from . import ha_private212
      from .compiled_solar627 import refresh
      old_selector=ha_private212.select_executor
      def selector(owner,signed,*,runtime=runtime,old_selector=old_selector):
       if owner is self.hass and signed._iid==runtime.iid and self.ready('CP-SOLAR'):return signed.execute,lambda:None
       return old_selector(owner,signed)
      ha_private212.select_executor=selector
      self.closers.append(lambda old=old_selector,fn=selector:setattr(ha_private212,'select_executor',old) if ha_private212.select_executor is fn else None)
      controller=rows[0];bridge=controller.bridge;old_execute=bridge._execute
      async def solar_execute(operation,args,request_id,runtime=runtime):
       return await self.hass.async_add_executor_job(runtime.execute,operation,args,request_id)
      bridge._execute=solar_execute
      self.closers.append(lambda bridge=bridge,old=old_execute,fn=solar_execute:setattr(bridge,'_execute',old) if bridge._execute is fn else None)
      mirror=controller.mirror;old_refresh=mirror.refresh;mirror._compiled627_runtime=runtime
      mirror.refresh=MethodType(refresh,mirror);new_refresh=mirror.refresh
      self.closers.append(lambda mirror=mirror,old=old_refresh,fn=new_refresh:setattr(mirror,'refresh',old) if mirror.refresh is fn else None)
   if 'CP-INVENTORY' in modules:
    from .compiled_loader627 import Namespace
    row=modules['CP-INVENTORY']
    namespace=await self.hass.async_add_executor_job(partial(Namespace,row['folder'],sku='CP-INVENTORY',public_key=self.public_key,state_root=self.root,allow_test=self.allow_test))
    self.closers.append(namespace.close)
    adapter=await self.hass.async_add_executor_job(namespace.load,'cp_inventory/ha.py')
    context={**self.context,'client':LocalSDK(self.context['trial_id'],self.runtimes)}
    inventory=await adapter.register(self.hass,entry,context);self.closers.append(inventory.close)
    from types import SimpleNamespace
    status_runtimes['CP-INVENTORY']=SimpleNamespace(namespace=namespace,iid=self.context['trial_id'],closed=False)
   bridge=self.hass.data.get('cloudpelizzon',{}).get('core',{}).get('status_transport')
   if bridge is not None:
    from .compiled_status627 import Status
    status=Status(self.hass,bridge,status_runtimes);self.closers.append(status.close)
   return self
  except BaseException:self.close();raise
 def close(self):
  if self.closed:return
  self.closed=True
  for close in reversed(self.closers):
   try:close()
   except Exception:pass
  for runtime in self.runtimes.values():
   try:runtime.close()
   except Exception:pass

async def register(hass,entry,context,*,public_key,allow_test=False):
 root=Path(hass.config.path('.storage/cloudpelizzon_compiled627'))
 registration=Registration(hass,context,root,public_key,allow_test=allow_test)
 modules=await registration.load();return await registration.attach(entry,modules)
