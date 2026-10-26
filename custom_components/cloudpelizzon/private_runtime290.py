"""Verified local configuration runtimes for the remaining commercial modules.

These are engine adapters, not HA device executors or commercial readiness flags.
Only the separate HA installer may publish a ready marker after full handoff.
"""
import asyncio,json,threading,uuid
from datetime import datetime,timezone
if __package__:
 from .module_package243 import canonical,sha,verify
 from .local_authorization246 import Gate
 from .private_namespace255 import VerifiedNamespace
 from .module_migrations250 import SCHEMAS
 from . import tenant_migration246 as migration
 from .local_security_migration287 import restore_configuration
else:
 from module_package243 import canonical,sha,verify
 from local_authorization246 import Gate
 from private_namespace255 import VerifiedNamespace
 from module_migrations250 import SCHEMAS
 import tenant_migration246 as migration
 from local_security_migration287 import restore_configuration

def need(ok,code):
 if not ok:raise PermissionError(code)

class LocalPackageRuntime:
 def __init__(self,packet,archive,*,client,core_id,signer_sha256,allowed_operations,database,authority_database,resources,gate_options=None,schema=None):
  self.closed=True;self.namespace=None;self.gate=None;self.lock=threading.RLock()
  manifest,_=verify(packet,archive,sku=self.sku,signer_sha256=signer_sha256,core_id=core_id,allowed_operations=allowed_operations)
  manifest=json.loads(canonical(manifest));self.release=sha(canonical(manifest));schema=SCHEMAS[self.sku] if schema is None else schema
  need(schema.sku==self.sku,'matching_installed_migration_adapter_required')
  need(manifest['entrypoint']==self.entrypoint and manifest['migration_contract']=='cp.'+self.sku[3:].lower()+'.migration.v1','approved_local_adapter_required')
  self.database=migration.safe(database);authority=migration.safe(authority_database)
  need(self.database.resolve()!=authority.resolve(),'separate_authority_ledger_required')
  migration.identity(schema,core_id,client._iid,self.release)
  with migration.closing(migration.ro(self.database)) as con:
   need(con.execute('SELECT core_id,signed_id,sku,package_manifest_sha256 FROM migration_identity246').fetchall()==[(core_id,client._iid,self.sku,self.release)],'completed_matching_migration_required')
   for table in schema.tables:
    need(con.execute('SELECT COUNT(*) FROM '+table.name+' WHERE '+table.tenant_column+' IS NULL OR '+table.tenant_column+'<>?',(client._iid,)).fetchone()[0]==0,'another_installation_in_local_database')
  options=dict(gate_options or {})
  need(not {'client','sku','operations','database','package_ready'}&set(options),'trusted_gate_configuration_required')
  try:
   self.namespace=VerifiedNamespace(packet,archive,sku=self.sku,pin=signer_sha256,core=core_id,operations=allowed_operations,resources=resources)
   self.gate=Gate(client,sku=self.sku,operations=manifest['operations'],database=authority,package_ready=lambda:not self.closed,**options)
   self.iid=client._iid;self.manifest=manifest;self.core_id=core_id
  except BaseException:self.close();raise
 def close(self):
  with self.lock:
   self.closed=True
   if self.gate:self.gate.close()
   if self.namespace:self.namespace.close()

class LightingRuntime(LocalPackageRuntime):
 sku='CP-LIGHTING';entrypoint='lighting_service.py'
 def __init__(self,*args,**kwargs):
  super().__init__(*args,**kwargs)
  try:self.service_type=self.namespace.load(self.entrypoint).LightingConfiguration;self.closed=False
  except BaseException:self.close();raise
 def execute(self,actor,operation,args,request_id,*,inventory=(),actor_guard=lambda:False):
  # Actor identity and inventory are supplied by the authenticated HA adapter.
  with self.lock:
   need(not self.closed and actor_guard() is True,'active_HA_actor_required')
   rows=json.loads(canonical(list(inventory)));parameters=json.loads(canonical(args))
   need(len(rows)<=2000,'bounded_scoped_inventory_required')
   bound={'actor_id':actor,'parameters':parameters,'inventory_sha256':sha(canonical(rows))}
   async def authorize(iid,uid,op,value,rid):
    need(iid==self.iid and uid==actor and op==operation and rid==request_id and canonical(value)==canonical(parameters),'local_lighting_request_binding')
    need(not self.closed and actor_guard() is True,'active_HA_actor_required')
    await self.gate.allowed(iid,op,bound,rid) or need(False,'fresh_paid_authorization_required')
    need(not self.closed and actor_guard() is True,'active_HA_actor_required');return True
   async def scoped(iid,uid):
    need(iid==self.iid and uid==actor and actor_guard() is True,'scoped_HA_inventory_required')
    return json.loads(canonical(rows))
   service=self.service_type(self.database,installations={self.iid},authorizer=authorize,inventory=scoped)
   return asyncio.run(service.execute(self.iid,actor,operation,parameters,request_id))

SECURITY_OPS={'config.read':'security.config.read','config.write':'security.config.write','engines.read':'security.config.read','engines.update':'security.config.write',
 'native.read':'security.dashboard.read','feed':'security.dashboard.read','manual':'security.engine.delayed_action','effects':'security.engine.delayed_action','native.mode':'security.engine.delayed_action',
 **{'alarm.'+a:'security.alarm.'+a for a in ('arm_home','arm_away','disarm','trigger','panic')}}

class SecurityRuntime(LocalPackageRuntime):
 sku='CP-SECURITY';entrypoint='live126.py'
 def __init__(self,*args,timezone_name='UTC',clock=lambda:datetime.now(timezone.utc),**kwargs):
  super().__init__(*args,**kwargs);self.clock=clock;self.timezone=timezone_name
  try:
   self.kernel=self.namespace.load(self.entrypoint).Kernel(self.database,clock)
   self.bootstrap=restore_configuration(self.database,iid=self.iid,core_id=self.core_id,release=self.release,kernel=self.kernel,controller=self.namespace.load('controller134.py'),now=clock().timestamp())
   self.closed=False
  except BaseException:self.close();raise
 def execute(self,operation,args,request_id,*,actor_guard=lambda:False):
  with self.lock:
   need(not self.closed and actor_guard() is True,'active_security_actor_required')
   args=json.loads(canonical(args));action=args.get('action')
   need(set(args)=={'action','payload'} and type(args['payload']) is dict and SECURITY_OPS.get(action)==operation,'security_local_operation_binding')
   self.gate.authorize(self.iid,operation,args,request_id)
   need(not self.closed and actor_guard() is True,'active_security_actor_required')
   if action=='effects':return self.kernel.effects(self.iid,args['payload'])
   return asyncio.run(self.kernel.execute(self.iid,action,args['payload'],request_id,timezone_name=self.timezone,verified=True))
 def prepare(self,args,request_id,*,actor_guard=lambda:False):
  with self.lock:
   need(not self.closed and actor_guard() is True,'active_security_actor_required')
   args=json.loads(canonical(args))
   self.gate.authorize(self.iid,'security.config.read',{'local_session':args},request_id)
   need(actor_guard() is True and not self.closed,'active_security_actor_required')
   return self.kernel.prepare(self.iid,args)
 def disconnect(self):
  with self.lock:
   if not self.closed:self.kernel.disconnect(self.iid)

class AutomationRuntime(LocalPackageRuntime):
 sku='CP-AUTOMATION';entrypoint='cp_automation25/service.py'
 def __init__(self,*args,validator,**kwargs):
  super().__init__(*args,**kwargs);self.async_lock=asyncio.Lock()
  try:
   need(callable(validator),'native_HA_validator_required')
   # Gate.allowed is async but its network/SQLite work is synchronous.
   async def gate(iid,op,args,rid):
    try:await asyncio.to_thread(self.gate.authorize,iid,op,args,rid);return True
    except Exception:return False
   self.service=self.namespace.load(self.entrypoint).AutomationService(self.database,installations={self.iid},authorizer=gate,validator=validator)
   self.closed=False
  except BaseException:self.close();raise
 async def execute_async(self,operation,args,request_id):
  async with self.async_lock:
   need(not self.closed,'local_automation_closed')
   # Activation/execution awaits the separate HA event/effect ownership handoff.
   need(operation not in ('automation.rules.activate','automation.rules.execute'),'local_execution_handoff_required')
   return await self.service.execute(self.iid,operation,args,request_id)
