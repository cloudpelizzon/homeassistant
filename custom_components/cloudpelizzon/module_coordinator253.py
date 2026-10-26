"""Common HA installation adapter; retain the existing Solar installer unchanged."""
import asyncio,json,threading,uuid
from pathlib import Path
if __package__:
 from . import module_package243 as package,tenant_migration246 as migration
 from .module_protocol252 import Client
 from .private_runtime248 import MaintenanceRuntime
else:
 import module_package243 as package,tenant_migration246 as migration
 from module_protocol252 import Client
 from private_runtime248 import MaintenanceRuntime

READY='cloudpelizzon_private_local_ready253'
PIN='fdcc00c16286059bb9d7d9a5dcbe047ba5a5e93891c22870aaac2f82490be5be'
MAINTENANCE_RELEASE='c7ceb664e0e87bb6bade2c497c0b5f3ffa6bccae7ecb87ac30951d5320e1f671'
def need(ok,code):
 if not ok:raise PermissionError(code)
async def completed(future):
 task=asyncio.ensure_future(future)
 try:return await asyncio.shield(task)
 except asyncio.CancelledError:
  try:await asyncio.shield(task)
  finally:raise
def write_marker(path,value):
 if __package__:
  from .private_modules216 import write_private
  return write_private(path,value)
 # Standalone fixture uses the same atomic replacement without HA imports.
 import os
 temp=path.with_name('.'+path.name+'-'+uuid.uuid4().hex)
 try:
  fd=os.open(temp,os.O_CREAT|os.O_EXCL|os.O_WRONLY|getattr(os,'O_NOFOLLOW',0),0o600)
  with os.fdopen(fd,'wb') as f:f.write(package.canonical(value));f.flush();os.fsync(f.fileno())
  temp.replace(path)
 finally:temp.unlink(missing_ok=True)

class LocalRouter:
 def __init__(self,client):
  self.client=client;self.original=client.execute;self.lock=threading.RLock();self.runtime=None;self.paused=False;self.closed=False
  self.dispatch=self.execute;client.execute=self.dispatch
 def execute(self,sku,operation,args=None,request_id=None):
  with self.lock:
   need(not self.closed and not self.paused,'module_installation_in_progress')
   if sku=='CP-MAINTENANCE' and self.runtime is not None:return self.runtime.execute(operation,args or {},request_id or uuid.uuid4().hex)
   return self.original(sku,operation,args,request_id=request_id)
 def freeze(self):
  with self.lock:need(not self.closed and not self.paused,'module_installation_in_progress');self.paused=True
 def resume(self):
  with self.lock:self.paused=False
 def close(self):
  with self.lock:
   self.closed=True
   if self.client.execute is self.dispatch:self.client.execute=self.original
   if self.runtime:self.runtime.close();self.runtime=None

class MaintenanceInstaller:
 sku='CP-MAINTENANCE'
 def __init__(self,hass,entry,context,legacy,*,operations,pin=PIN,release=MAINTENANCE_RELEASE,transport=None,gate_options=None):
  self.hass=hass;self.entry=entry;self.context=context;self.legacy=legacy;self.operations=tuple(operations);self.pin=pin;self.release=release
  self.transport=transport;self.gate_options=gate_options;self.closed=False;self.lock=asyncio.Lock();self.step='';self.router=None
 def guard(self,connection):need(not self.closed,'module_installer_closed');self.legacy.guard(connection)
 async def job(self,fn,*args):return await completed(self.hass.async_add_executor_job(fn,*args))
 def controller(self):
  runtime=self.hass.data.get('cloudpelizzon',{}).get('maintenance',{})
  rows=[r['remote_controller'] for r in runtime.values() if isinstance(r,dict) and 'remote_controller' in r]
  need(len(rows)==1 and not rows[0].closed and rows[0].iid==self.context['trial_id'],'same_installation_maintenance_runtime_required')
  return rows[0]
 def folder(self):return migration.safe(Path(self.hass.config.path()).resolve()/'.storage/cloudpelizzon_modules253/CP-MAINTENANCE')
 def progress(self,step,*counts):self.step=step
 def protocol(self,guard):
  options={'guard':guard}
  if self.transport is not None:options['transport']=self.transport
  return Client(self.controller().client,self.sku,**options)
 def ensure_router(self):
  controller=self.controller()
  if self.router is None:self.router=LocalRouter(controller.client)
  return self.router
 def active(self):
  root=self.folder();marker=migration.safe(root/'active.json')
  if not marker.is_file():return None
  value=json.loads(marker.read_bytes())
  need(set(value)=={'schema','core_id','signed_id','sku','manifest_sha256','folder','migration_counts'}
   and value['schema']=='cp.local.module253.v1' and value['core_id']==self.context['core_id'] and value['signed_id']==self.context['trial_id']
   and value['sku']==self.sku and value['manifest_sha256']==self.release and type(value['folder']) is str
   and len(value['folder'])==32 and all(c in '0123456789abcdef' for c in value['folder']),'committed_local_installation_binding_required')
  folder=migration.safe(root/value['folder']);packet=json.loads((folder/'package.json').read_bytes());archive=(folder/'module.tar').read_bytes()
  return {'folder':folder,'packet':packet,'archive':archive,'database':folder/'local.sqlite3','migration_counts':value['migration_counts']}
 def create(self,candidate):
  need(package.sha(package.canonical(candidate['packet']['manifest']))==self.release,'published_maintenance_release_required')
  return MaintenanceRuntime(candidate['packet'],candidate['archive'],client=self.controller().client,core_id=self.context['core_id'],signer_sha256=self.pin,
   allowed_operations=self.operations,database=candidate['database'],authority_database=candidate['folder']/'authority.sqlite3',timezone=self.hass.config.time_zone,gate_options=self.gate_options)
 async def restore(self):
  need(not self.closed,'module_installer_closed')
  candidate=await self.job(self.active)
  if candidate is None:return False
  router=self.ensure_router()
  if router.runtime is not None:return True
  runtime=await self.job(self.create,candidate)
  try:
   result=await self.job(runtime.execute,'maintenance.records.read',{},uuid.uuid4().hex)
   need(type(result) is dict and type(result.get('maintenances')) is list,'native_local_maintenance_projection_required')
   need(not self.closed,'module_installer_closed');router.runtime=runtime
   self.hass.data.setdefault(READY,{})[self.sku]={'core_id':self.context['core_id'],'signed_id':self.context['trial_id']}
   return True
  except BaseException:await self.job(runtime.close);raise
 async def status(self,connection):
  self.guard(connection)
  if self.lock.locked():return {'mode':'installing','can_install':False,'message':self.step or 'Instalação em andamento'}
  async with self.lock:
   try:
    if await self.restore():return {'mode':'local','can_install':False,'message':'Módulo completo instalado e vinculado a este HA.'}
    value=await self.job(self.protocol(lambda:self.guard(connection)).release);self.guard(connection)
    need(package.sha(package.canonical(value['package']['manifest']))==self.release,'published_maintenance_release_required')
    return {'mode':'remote','can_install':True,'message':'Pacote completo disponível para instalação neste HA.'}
   except Exception:return {'mode':'unavailable','can_install':False,'message':'Não foi possível confirmar licença, pacote e instalação. Nenhum dado foi substituído.'}
 async def install(self,connection,confirmed):
  self.guard(connection);need(confirmed is True,'explicit_local_installation_choice_required');need(not self.lock.locked(),'module_installation_in_progress')
  async with self.lock:
   guard=lambda:self.guard(connection)
   if await self.restore():return {'installed':True,'engine_mode':'local','reused':True}
   router=self.ensure_router();candidate=None;runtime=None;committed=False;marker_written=False
   # An unreadable prior commit must never be replaced with an empty new install.
   need(not (self.folder()/'active.json').exists(),'existing_local_installation_preserved')
   await self.job(router.freeze)
   try:
    self.step='Conferindo licença e preservando os dados'
    def prepare():
     root=self.folder();root.parent.mkdir(mode=0o700,parents=True,exist_ok=True);root.mkdir(mode=0o700,exist_ok=True)
     migration.safe(root);return root/uuid.uuid4().hex
    folder=await self.job(prepare);guard()
    client=self.protocol(guard)
    def stage():return client.stage(folder,core_id=self.context['core_id'],publisher_pin=self.pin,allowed_operations=self.operations,schema=migration.MAINTENANCE,progress=self.progress)
    candidate=await self.job(stage);guard();self.step='Validando o motor local de Manutenção'
    runtime=await self.job(self.create,candidate)
    result=await self.job(runtime.execute,'maintenance.records.read',{},uuid.uuid4().hex);guard()
    need(type(result) is dict and type(result.get('maintenances')) is list,'native_local_maintenance_projection_required')
    marker={'schema':'cp.local.module253.v1','core_id':self.context['core_id'],'signed_id':self.context['trial_id'],'sku':self.sku,
     'manifest_sha256':self.release,'folder':folder.name,'migration_counts':candidate['migration_counts']}
    await self.job(write_marker,self.folder()/'active.json',marker);marker_written=True;guard()
    router.runtime=runtime;self.hass.data.setdefault(READY,{})[self.sku]={'core_id':self.context['core_id'],'signed_id':self.context['trial_id']}
    committed=True;self.step='Módulo completo instalado neste HA'
    return {'installed':True,'engine_mode':'local','native_local_read_verified':True,'migration_counts':candidate['migration_counts'],'device_commands':0,'data_preserved':True}
   finally:
    if not committed:
     if runtime:await self.job(runtime.close)
     self.hass.data.get(READY,{}).pop(self.sku,None)
     if marker_written:
      def failed_marker():
       p=self.folder()/'active.json';p.rename(self.folder()/('failed-'+uuid.uuid4().hex+'.json'))
      await self.job(failed_marker)
    await self.job(router.resume)
 def close(self):
  self.closed=True;self.hass.data.get(READY,{}).pop(self.sku,None)
  if self.router:self.router.close()

async def register(hass,entry,context):
 from . import private_modules216 as previous
 from .maintenance_catalog253 import OPERATIONS
 close_previous=previous.register(hass,entry,context);legacy=hass.data[previous.KEY]
 adapter=MaintenanceInstaller(hass,entry,context,legacy,operations=OPERATIONS)
 original_status=legacy.status;original_install=legacy.install
 bridge=hass.data['cloudpelizzon']['core']['status_transport'];original_ready=bridge.local_ready
 def ready():
  values=set(original_ready())
  for sku,identity in hass.data.get(READY,{}).items():
   if identity=={'core_id':context['core_id'],'signed_id':context['trial_id']}:values.add(sku)
  return values
 bridge.local_ready=ready
 async def status(sku,connection):return await (adapter.status(connection) if sku==adapter.sku else original_status(sku,connection))
 async def install(sku,connection,confirmed):return await (adapter.install(connection,confirmed) if sku==adapter.sku else original_install(sku,connection,confirmed))
 legacy.status=status;legacy.install=install
 def close():
  adapter.close();legacy.status=original_status;legacy.install=original_install
  if bridge.local_ready is ready:bridge.local_ready=original_ready
  close_previous()
 try:
  try:await adapter.restore()
  except Exception:pass # Offline restoration keeps local data and access closed.
  return close
 except BaseException:close();raise
