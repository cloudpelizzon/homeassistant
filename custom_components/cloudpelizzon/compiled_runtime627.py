"""Adapters matching the existing HA module ports; no private engine source."""
import asyncio,threading,uuid,json
from pathlib import Path
from datetime import datetime,timezone
from .compiled_loader627 import Namespace
from .offline_authorization627 import Gate

class Runtime:
 def __init__(self,folder,*,sku,public_key,state_root,iid,core_id,database,allow_test=False,timezone_name='UTC'):
  self.closed=False;self.sku=sku;self.iid=iid;self.core_id=core_id;self.lock=threading.RLock();self.database=Path(database);self.timezone=timezone_name
  self.namespace=Namespace(folder,sku=sku,public_key=public_key,state_root=state_root,allow_test=allow_test)
  self.manifest={**self.namespace.manifest,'operations':self.namespace.guard.verify(sku)['operations']}
  self.gate=Gate(self.namespace,sku=sku,iid=iid,database=self.database.with_name('authority627.sqlite3'),ready=lambda:not self.closed)
  if sku=='CP-MAINTENANCE':self.service=self.namespace.load('cp_maintenance/service.py').MaintenanceService(self.database,installations={iid:timezone_name},authorizer=self.gate.allowed)
  elif sku=='CP-SOLAR':self.service=self.namespace.load('solar_engine/service.py').SolarService(self.database,installations={iid},authorizer=self.gate.allowed)
  elif sku=='CP-SECURITY':self.kernel=self.namespace.load('live126.py').Kernel(self.database,lambda:datetime.now(timezone.utc))
  elif sku=='CP-LIGHTING':self.service_type=self.namespace.load('lighting_service.py').LightingConfiguration
  if sku=='CP-AUTOMATION':
   self.namespace.load('native_engine85.py');self.namespace.load('cloudpelizzon_relay/protocol.py')
  elif sku=='CP-SECURITY':self.namespace.load('security_wire126.py')
 def close(self):
  self.closed=True;self.gate.close();self.namespace.close()
 def execute(self,operation,args,request_id):
  with self.lock:
   if self.closed:raise PermissionError('compiled_runtime_closed')
   return asyncio.run(self.service.execute(self.iid,operation,args,request_id))

class LightingRuntime(Runtime):
 def execute(self,actor,operation,args,request_id,*,inventory=(),actor_guard=lambda:False):
  with self.lock:
   if self.closed or actor_guard() is not True:raise PermissionError('active_HA_actor_required')
   parameters=json.loads(json.dumps(args));rows=json.loads(json.dumps(list(inventory)))
   async def allowed(iid,uid,op,value,rid):
    if self.closed or actor_guard() is not True or iid!=self.iid or uid!=actor or op!=operation or rid!=request_id or value!=parameters:raise PermissionError('compiled_actor_binding')
    await self.gate.allowed(iid,op,{'actor_id':actor,'parameters':parameters},rid)
    if actor_guard() is not True:raise PermissionError('HA_actor_changed')
    return True
   async def scoped(iid,uid):
    if actor_guard() is not True or iid!=self.iid or uid!=actor:raise PermissionError('HA_inventory_scope')
    return rows
   service=self.service_type(self.database,installations={self.iid},authorizer=allowed,inventory=scoped)
   return asyncio.run(service.execute(self.iid,actor,operation,parameters,request_id))

class AutomationRuntime(Runtime):
 def configure_validator(self,validator):
  if not callable(validator):raise PermissionError('native_validator_required')
  self.service=self.namespace.load('cp_automation25/service.py').AutomationService(self.database,installations={self.iid},authorizer=self.gate.allowed,validator=validator)
  return self
 async def execute_async(self,operation,args,request_id):
  if self.closed:raise PermissionError('compiled_runtime_closed')
  return await self.service.execute(self.iid,operation,args,request_id)

class SecurityRuntime(Runtime):
 def execute(self,operation,args,request_id,*,actor_guard=lambda:False):
  with self.lock:
   if self.closed or actor_guard() is not True:raise PermissionError('active_security_actor_required')
   if set(args)!={'action','payload'} or self.namespace.guard.security_operation(args['action'])!=operation:raise PermissionError('security_action_binding')
   self.gate.authorize(self.iid,operation,args,request_id)
   if actor_guard() is not True:raise PermissionError('security_actor_changed')
   if args['action']=='effects':return self.kernel.effects(self.iid,args['payload'])
   return asyncio.run(self.kernel.execute(self.iid,args['action'],args['payload'],request_id,timezone_name=self.timezone,verified=True))
 def prepare(self,args,request_id,*,actor_guard=lambda:False):
  if self.closed or actor_guard() is not True:raise PermissionError('security_actor_required')
  self.gate.authorize(self.iid,'security.config.read',{'local_session':args},request_id)
  if actor_guard() is not True:raise PermissionError('security_actor_changed')
  return self.kernel.prepare(self.iid,args)
 def disconnect(self):self.kernel.disconnect(self.iid)

class LocalSDK:
 def __init__(self,iid,runtimes):self._iid=iid;self.runtimes=runtimes
 def execute(self,sku,operation,args,*,request_id):
  runtime=self.runtimes.get(sku)
  if runtime is None or runtime.closed or runtime.iid!=self._iid:raise PermissionError('local_module_not_installed')
  return runtime.execute(operation,args,request_id)
