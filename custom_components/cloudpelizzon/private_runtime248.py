"""Private package loading and Maintenance bootstrap for the common HA installer.

Only verified source bytes enter a private Python namespace. The HA coordinator
must provide the trusted catalog, pinned publisher and completed local migration.
This module neither downloads packages nor grants a license.
"""
import asyncio,importlib,importlib.abc,importlib.util,json,sys,threading,types,uuid
from pathlib import Path
if __package__:
 from .module_package243 import verify,canonical,sha
 from .local_authorization246 import Gate
 from . import tenant_migration246 as migration
else:
 from module_package243 import verify,canonical,sha
 from local_authorization246 import Gate
 import tenant_migration246 as migration

def need(ok,code):
 if not ok:raise PermissionError(code)

class PackageNamespace(importlib.abc.MetaPathFinder,importlib.abc.Loader):
 def __init__(self,files):
  self.prefix='_cp_private248_'+uuid.uuid4().hex
  self.files=dict(files);self.closed=False
  root=types.ModuleType(self.prefix);root.__path__=[];root.__package__=self.prefix
  sys.modules[self.prefix]=root;sys.meta_path.insert(0,self)
 def source(self,name):
  if not name.startswith(self.prefix+'.'):return None
  rel=name[len(self.prefix)+1:].replace('.','/')
  for path,package in ((rel+'/__init__.py',True),(rel+'.py',False)):
   if path in self.files:return path,package
  return None
 def find_spec(self,fullname,path=None,target=None):
  if self.closed:return None
  item=self.source(fullname)
  if item:return importlib.util.spec_from_loader(fullname,self,is_package=item[1])
  return None
 def create_module(self,spec):return None
 def exec_module(self,module):
  need(not self.closed,'private_package_closed')
  path,package=self.source(module.__name__)
  exec(compile(self.files[path],'<signed-private-module>/'+path,'exec'),module.__dict__)
 def load(self,path):
  need(not self.closed and path.endswith('.py') and path in self.files,'verified_entrypoint_required')
  return importlib.import_module(self.prefix+'.'+path[:-3].replace('/','.'))
 def close(self):
  self.closed=True
  if self in sys.meta_path:sys.meta_path.remove(self)
  for name in tuple(sys.modules):
   if name==self.prefix or name.startswith(self.prefix+'.'):sys.modules.pop(name,None)
  self.files.clear()

class MaintenanceRuntime:
 sku='CP-MAINTENANCE'
 def __init__(self,packet,archive,*,client,core_id,signer_sha256,allowed_operations,
              database,authority_database,timezone,gate_options=None):
  self.closed=True;self.lock=threading.RLock();self.namespace=None;self.gate=None
  manifest,files=verify(packet,archive,sku=self.sku,signer_sha256=signer_sha256,
                       core_id=core_id,allowed_operations=allowed_operations)
  manifest=json.loads(canonical(manifest));release=sha(canonical(manifest))
  need(manifest['entrypoint']=='cp_maintenance/service.py'
       and manifest['migration_contract']=='cp.maintenance.migration.v1','approved_maintenance_adapter_required')
  self.database=migration.safe(database);authority_database=migration.safe(authority_database)
  need(self.database.resolve()!=authority_database.resolve(),'separate_authority_ledger_required')
  migration.identity(migration.MAINTENANCE,core_id,client._iid,release)
  # Never initialize a new empty database over a missing or mismatched migration.
  with migration.closing(migration.ro(self.database)) as con:
   need(con.execute('SELECT core_id,signed_id,sku,package_manifest_sha256 FROM migration_identity246').fetchall()
        ==[(core_id,client._iid,self.sku,release)],'completed_matching_migration_required')
   for table in migration.MAINTENANCE.tables:
    need(con.execute('SELECT COUNT(*) FROM '+table.name+' WHERE '+table.tenant_column+' IS NULL OR '+table.tenant_column+'<>?',(client._iid,)).fetchone()[0]==0,'another_installation_in_local_database')
  options=dict(gate_options or {})
  need(not {'sku','operations','database','package_ready','client'}&set(options),'trusted_gate_configuration_required')
  try:
   self.namespace=PackageNamespace(files)
   service=self.namespace.load(manifest['entrypoint']).MaintenanceService
   self.gate=Gate(client,sku=self.sku,operations=manifest['operations'],database=authority_database,
                  package_ready=lambda:not self.closed,**options)
   self.service=service(self.database,installations={client._iid:timezone},authorizer=self.gate.allowed)
   self.iid=client._iid;self.manifest=manifest;self.closed=False
  except BaseException:
   self.close();raise
 def execute(self,operation,args,request_id):
  # Called in HA's executor, as the existing local Solar adapter is. The native
  # asynchronous service keeps its transaction and idempotency implementation.
  with self.lock:
   need(not self.closed,'local_runtime_closed')
   return asyncio.run(self.service.execute(self.iid,operation,args,request_id))
 def close(self):
  with self.lock:
   self.closed=True
   if self.gate:self.gate.close()
   if self.namespace:self.namespace.close()
