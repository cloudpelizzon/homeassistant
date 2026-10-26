"""HA effect boundary shared by verified local Automation and Security engines.

No background worker starts here. The HA handoff supplies owner, approved policy
and a current-generation check. Native command validation and fresh paid receipts
remain mandatory, followed by HA's own control ACL and a durable attempt ledger.
"""
import asyncio,json,sqlite3,uuid
from contextlib import closing
from datetime import datetime
if __package__:
 from .module_package243 import canonical,sha
 from .tenant_migration246 import safe
else:
 from module_package243 import canonical,sha
 from tenant_migration246 import safe

def need(ok,code):
 if not ok:raise PermissionError(code)

def native_context(owner):
 from homeassistant.core import Context
 return Context(user_id=owner)

def native_target_guard(hass,data):
 # Preserve the existing mirror boundary: observer-only entities are never
 # converted into locally controllable devices by a commercial module.
 from .homolog_mirror.policy import deny_read_only_targets
 deny_read_only_targets(hass,data)

class LocalEffects:
 def __init__(self,hass,runtime,*,owner_id,generation,effects,current_policy,database,context_factory=native_context,target_guard=native_target_guard):
  need(runtime.sku in ('CP-AUTOMATION','CP-SECURITY') and callable(current_policy),'verified_local_effect_runtime_required')
  need(type(owner_id) is str and 1<=len(owner_id)<=128 and type(generation) is str and len(generation)>=16,'explicit_HA_effect_owner_required')
  need(type(effects) is list and len(effects)<=200 and all(type(row) is list and len(row)==3 and all(type(x) is str for x in row) for row in effects),'explicit_HA_effect_policy_required')
  self.hass=hass;self.runtime=runtime;self.owner_id=owner_id;self.generation=generation
  self.policy=json.loads(canonical({'owner_id':owner_id,'generation':generation,'effects':effects}))
  self.current_policy=current_policy;self.database=safe(database);self.context_factory=context_factory;self.target_guard=target_guard
  need(self.database.resolve() not in (runtime.database.resolve(),runtime.gate.database.resolve()),'separate_effect_ledger_required')
  self.closed=False;self.lock=asyncio.Lock()
 def check(self):
  need(not self.closed and not self.runtime.closed and self.current_policy()==self.policy,'local_effect_handoff_changed')
 async def owner(self,entities):
  self.check();user=await self.hass.auth.async_get_user(self.owner_id);self.check()
  need(user is not None and user.is_active and not getattr(user,'system_generated',False),'active_effect_owner_required')
  if not user.is_admin:
   need(bool(entities) and all(user.permissions.check_entity(e,'control') is True for e in entities),'HA_control_permission_required')
  return user
 def validate(self,value):
  self.check();value=json.loads(canonical(value));need(len(canonical(value))<=8192,'bounded_local_effect_required')
  effects=self.policy['effects'];targets={row[2] for row in effects if row[2]}
  if self.runtime.sku=='CP-AUTOMATION':
   validator=self.runtime.namespace.load('cloudpelizzon_relay/protocol.py');value=validator.command(value,self.runtime.iid,targets)
  else:
   validator=self.runtime.namespace.load('security_wire126.py');value=validator.command(value,self.runtime.iid,effects)
  data=value['data'];need(not set(data)&{'device_id','area_id','floor_id','label_id','target','service'},'expanded_local_targets_denied')
  domain,service=value['service'].split('.');entities=data.get('entity_id','')
  entities=[entities] if type(entities) is str else entities
  need(type(entities) is list and all(type(e) is str for e in entities),'explicit_local_targets_required')
  need(all([domain,service,e] in effects for e in entities),'approved_local_effect_required')
  return value,[e for e in entities if e]
 def reserve(self,value):
  safe(self.database)
  key=sha(canonical([self.runtime.sku,self.runtime.iid,value['code'],value['revision'],value['event_id'],value['sequence']]))
  digest=sha(canonical(value))
  with closing(sqlite3.connect(self.database,timeout=5)) as db,db:
   db.execute('CREATE TABLE IF NOT EXISTS local_effect_attempts291(id TEXT PRIMARY KEY,digest TEXT NOT NULL,state TEXT NOT NULL)')
   row=db.execute('SELECT digest,state FROM local_effect_attempts291 WHERE id=?',(key,)).fetchone()
   if row:
    need(row[0]==digest,'local_effect_event_conflict');return key,False
   need(db.execute('SELECT COUNT(*) FROM local_effect_attempts291').fetchone()[0]<100000,'local_effect_ledger_capacity')
   db.execute('INSERT INTO local_effect_attempts291 VALUES(?,?,?)',(key,digest,'reserved'))
   return key,True
 def finish(self,key,state):
  safe(self.database)
  with closing(sqlite3.connect(self.database,timeout=5)) as db,db:db.execute('UPDATE local_effect_attempts291 SET state=? WHERE id=?',(state,key))
 async def dispatch(self,command,*,deadline=None):
  async with self.lock:
   value,entities=self.validate(command);await self.owner(entities)
   op='automation.rules.execute' if self.runtime.sku=='CP-AUTOMATION' else 'security.engine.delayed_action'
   args={'stage':'local_effect','command':value,'owner_id':self.owner_id,'generation':self.generation,'policy_sha256':sha(canonical(self.policy))}
   claims=await self.hass.async_add_executor_job(self.runtime.gate.authorize,self.runtime.iid,op,args,uuid.uuid4().hex)
   await self.owner(entities)
   key,new=await self.hass.async_add_executor_job(self.reserve,value)
   if not new:return {'state':'already_attempted','automatic_retry':False}
   # Any interruption after reservation leaves a durable non-retryable attempt.
   await self.owner(entities);self.check()
   if deadline is not None:
    need(isinstance(deadline,datetime) and deadline.tzinfo is not None and self.runtime.gate.clock()<deadline,'local_effect_lease_expired')
   need(self.runtime.gate.clock()<datetime.fromisoformat(claims['expires_at'].replace('Z','+00:00')),'paid_receipt_expired_before_HA_dispatch')
   self.target_guard(self.hass,value['data']);self.check()
   domain,service=value['service'].split('.')
   try:
    await self.hass.services.async_call(domain,service,value['data'],blocking=True,context=self.context_factory(self.owner_id))
   except asyncio.CancelledError:raise
   except Exception:
    await self.hass.async_add_executor_job(self.finish,key,'uncertain')
    return {'state':'uncertain','automatic_retry':False}
   await self.hass.async_add_executor_job(self.finish,key,'service_completed')
   return {'state':'service_completed','physical_state_confirmed':False,'automatic_retry':False}
 def close(self):self.closed=True
