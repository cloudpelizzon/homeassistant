"""One transactional HA installer for registered engine adapters, independent of SKU.

Legacy validated installers can remain delegates. Descriptors alone never make
an engine ready: the trusted adapter must provide schema, health and attachment.
"""
import asyncio,base64,json,uuid
from pathlib import Path
from cryptography.hazmat.primitives import serialization,hashes
from cryptography.hazmat.primitives.asymmetric import padding
if __package__:
 from . import module_package243 as package,tenant_migration246 as migration
 from .module_protocol252 import Client
 from .module_coordinator253 import completed,write_marker,PIN
else:
 import module_package243 as package,tenant_migration246 as migration
 from module_protocol252 import Client
 from module_coordinator253 import completed,write_marker,PIN

READY='cloudpelizzon_private_local_ready295'
def need(ok,code):
 if not ok:raise PermissionError(code)

class ModuleInstaller:
 def __init__(self,hass,context,legacy,spec,adapter,*,pin=PIN,transport=None):
  self.hass=hass;self.context=context;self.legacy=legacy;self.spec=spec;self.adapter=adapter
  self.pin=pin;self.transport=transport;self.runtime=None;self.detach=None;self.closed=False
  self.lock=asyncio.Lock();self.step='';self.sku=spec.sku
  need(adapter.schema.sku==spec.sku and spec.read_operation in adapter.operations,'matching_installer_adapter_required')
 def guard(self,connection):
  need(not self.closed and not getattr(connection,'closed',False),'module_installer_closed');self.legacy.guard(connection)
 async def job(self,fn,*args):return await completed(self.hass.async_add_executor_job(fn,*args))
 def folder(self):return migration.safe(Path(self.hass.config.path()).resolve()/'.storage/cloudpelizzon_modules295'/self.sku)
 def protocol(self,guard):
  native=self.context['client'];need(native._iid==self.context['trial_id'],'matching_installer_identity_required')
  opts={'guard':guard,'module_spec':self.spec}
  if self.transport is not None:opts['transport']=self.transport
  return Client(native,self.sku,**opts)
 def advertisement(self,packet):
  need(type(packet) is dict and set(packet)=={'manifest','public_key','signature'},'signed_module_advertisement_required')
  public=base64.b64decode(packet['public_key'],validate=True)
  need(package.sha(public)==self.pin,'pinned_module_publisher_required')
  serialization.load_der_public_key(public).verify(base64.b64decode(packet['signature'],validate=True),package.PREFIX+package.canonical(packet['manifest']),padding.PKCS1v15(),hashes.SHA256())
  m=packet['manifest'];need(m['sku']==self.sku and package.sha(package.canonical(m))==self.spec.release_manifest_sha256 and set(m['operations'])<=set(self.adapter.operations),'approved_module_release_required')
 def active(self):
  marker=migration.safe(self.folder()/'active.json')
  if not marker.exists():return None
  value=json.loads(marker.read_bytes())
  need(set(value)=={'schema','core_id','signed_id','sku','manifest_sha256','folder','migration_counts'} and value['schema']=='cp.local.module295.v1'
   and value['core_id']==self.context['core_id'] and value['signed_id']==self.context['trial_id'] and value['sku']==self.sku
   and value['manifest_sha256']==self.spec.release_manifest_sha256 and type(value['folder']) is str and len(value['folder'])==32
   and all(c in '0123456789abcdef' for c in value['folder']),'committed_module_identity_required')
  folder=migration.safe(self.folder()/value['folder']);packet=json.loads(migration.safe(folder/'package.json').read_bytes())
  archive=migration.safe(folder/'module.tar').read_bytes();self.advertisement(packet)
  return {'folder':folder,'packet':packet,'archive':archive,'database':folder/'local.sqlite3','migration_counts':value['migration_counts']}
 def clear_ready(self):self.hass.data.get(READY,{}).pop(self.sku,None)
 def mark_ready(self):self.hass.data.setdefault(READY,{})[self.sku]={'core_id':self.context['core_id'],'signed_id':self.context['trial_id']}
 async def activate(self,candidate,guard):
  self.advertisement(candidate['packet']);runtime=None;detach=None;owned={}
  async def create():
   result=await self.adapter.create(candidate,self.context,self.pin);owned['runtime']=result;return result
  try:
   runtime=await completed(create())
   need(await self.adapter.health(runtime,guard) is True,'native_module_health_required');guard()
   async def attach():
    result=await self.adapter.attach(runtime,lambda:self.runtime is runtime and not self.closed);owned['detach']=result;return result
   detach=await completed(attach());guard();need(callable(detach),'owned_module_attachment_required')
   return runtime,detach
  except BaseException:
   detach=detach or owned.get('detach');runtime=runtime or owned.get('runtime')
   if callable(detach):detach()
   if runtime:await self.job(runtime.close)
   raise
 async def restore(self):
  need(not self.closed,'module_installer_closed')
  if self.runtime is not None:return True
  candidate=await self.job(self.active)
  if candidate is None:return False
  def guard():need(not self.closed,'module_installer_closed')
  runtime,detach=await self.activate(candidate,guard)
  self.runtime=runtime;self.detach=detach;self.mark_ready();return True
 async def status(self,connection):
  self.guard(connection)
  if self.lock.locked():return {'mode':'installing','can_install':False,'message':self.step or 'Instalação em andamento.'}
  async with self.lock:
   try:
    if await self.restore():return {'mode':'local','can_install':False,'message':'Módulo instalado neste Home Assistant.'}
    need(self.adapter.available() is True,'engine_adapter_integration_pending')
    value=await self.job(self.protocol(lambda:self.guard(connection)).release);self.guard(connection);self.advertisement(value['package'])
    return {'mode':'remote','can_install':True,'message':'Pacote verificado disponível para instalação.'}
   except Exception:return {'mode':'unavailable','can_install':False,'message':'Licença, pacote ou integração local ainda não puderam ser confirmados.'}
 async def install(self,connection,confirmed):
  self.guard(connection);need(confirmed is True,'explicit_module_installation_required')
  need(not self.lock.locked(),'module_installation_in_progress')
  async with self.lock:
   if await self.restore():return {'installed':True,'engine_mode':'local','reused':True}
   need(self.adapter.available() is True,'engine_adapter_integration_pending')
   need(not (self.folder()/'active.json').exists(),'existing_module_commit_preserved')
   guard=lambda:self.guard(connection);runtime=None;detach=None;committed=False;marker_written=False
   try:
    def prepare():
     root=self.folder();root.mkdir(mode=0o700,parents=True,exist_ok=True);migration.safe(root);return root/uuid.uuid4().hex
    folder=await self.job(prepare);guard();client=self.protocol(guard)
    def stage():return client.stage(folder,core_id=self.context['core_id'],publisher_pin=self.pin,allowed_operations=self.adapter.operations,schema=self.adapter.schema,progress=lambda step,*counts:setattr(self,'step',step))
    candidate=await self.job(stage);guard();self.advertisement(candidate['packet']);self.step='Validando o motor local'
    runtime,detach=await self.activate(candidate,guard)
    marker={'schema':'cp.local.module295.v1','core_id':self.context['core_id'],'signed_id':self.context['trial_id'],'sku':self.sku,'manifest_sha256':self.spec.release_manifest_sha256,'folder':folder.name,'migration_counts':candidate['migration_counts']}
    def commit_marker():
     nonlocal marker_written
     write_marker(self.folder()/'active.json',marker);marker_written=True
    await self.job(commit_marker);guard()
    self.runtime=runtime;self.detach=detach;self.mark_ready();committed=True
    return {'installed':True,'engine_mode':'local','native_module_health_verified':True,'migration_counts':candidate['migration_counts'],'device_commands':0,'data_preserved':True}
   finally:
    if not committed:
     self.clear_ready()
     if detach:detach()
     if runtime:await self.job(runtime.close)
     if marker_written:
      def quarantine():
       p=self.folder()/'active.json';migration.safe(p);p.rename(self.folder()/('failed-'+uuid.uuid4().hex+'.json'))
      await self.job(quarantine)
 def close(self):
  if self.closed:return
  self.closed=True;self.clear_ready()
  if self.detach:self.detach();self.detach=None
  if self.runtime:
   runtime=self.runtime;self.runtime=None
   # Close off the HA event loop; an in-flight authorization must be drained.
   async def drain():await self.job(runtime.close)
   self.hass.async_create_task(drain())

def attach_catalog(hass,context,legacy,bridge,registry,adapters,*,pin=PIN):
 """Attach generic module slots, retaining the validated legacy delegates."""
 original_status=legacy.status;original_install=legacy.install;original_ready=bridge.local_ready
 slots={spec.sku:ModuleInstaller(hass,context,legacy,spec,adapters[spec.runtime_adapter],pin=pin)
        for spec in registry.modules() if spec.runtime_adapter in adapters}
 async def status(sku,connection):
  spec=registry.get(sku)
  if sku in slots:return await slots[sku].status(connection)
  if spec.source_status=='legacy_deployed':return await original_status(sku,connection)
  legacy.guard(connection);return {'mode':'unavailable','can_install':False,'message':'A integração local deste módulo está em preparação.'}
 async def install(sku,connection,confirmed):
  spec=registry.get(sku)
  if sku in slots:return await slots[sku].install(connection,confirmed)
  if spec.source_status=='legacy_deployed':return await original_install(sku,connection,confirmed)
  legacy.guard(connection);raise PermissionError('engine_adapter_integration_pending')
 def ready():
  values=set(original_ready())
  for sku,slot in slots.items():
   if not slot.closed and slot.runtime is not None and not slot.runtime.closed:values.add(sku)
  return values
 legacy.status=status;legacy.install=install;bridge.local_ready=ready
 def close():
  for slot in slots.values():slot.close()
  if legacy.status is status:legacy.status=original_status
  if legacy.install is install:legacy.install=original_install
  if bridge.local_ready is ready:bridge.local_ready=original_ready
 return slots,close
