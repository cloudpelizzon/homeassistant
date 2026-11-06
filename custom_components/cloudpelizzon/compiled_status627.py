"""Explicit local license presentation; never fabricate an online authority claim."""
from datetime import datetime,timezone
from .public_core.projection import unavailable_catalog
from .public_core.bridge import STATUS,LICENSE,CONTRACTS

class Status:
 def __init__(self,hass,bridge,runtimes):
  self.hass=hass;self.bridge=bridge;self.runtimes=runtimes;self.old=bridge.handle;self.closed=False
  self.dispatch=self.handle;bridge.handle=self.dispatch
 async def view(self):
  view=unavailable_catalog(core_id=self.bridge.core_id,installed=self.bridge.installed,version=self.bridge.version,reason='offline_local_catalog')
  claims={}
  for sku,runtime in self.runtimes.items():
   try:
    if runtime.closed:continue
    claims[sku]=await self.hass.async_add_executor_job(runtime.namespace.guard.verify,sku,runtime.iid)
   except Exception:continue
  for row in view['modules']:
   c=claims.get(row['sku'])
   if c is None:continue
   row['installed']=True;row['local_installed']=True
   row['license']={'sku':row['sku'],'allowed':True,'status':'licensed','reason':None,'expires_at':datetime.fromtimestamp(c['expires_at'],timezone.utc).isoformat() if c['expires_at'] is not None else None}
   row['verification_source']='offline_vendor_signature';row['trial_available']=False
  view['verification_source']='offline_vendor_signature';view['status_verified']=bool(claims)
  view['license'].update(present=bool(claims),modules=sorted(claims),online_status='offline',last_checkin_error=None)
  return view
 async def handle(self,command,args=None,*,active=False):
  if self.closed or active is not True:raise PermissionError('active_session_required')
  if command not in CONTRACTS or type(args if args is not None else {}) is not dict:raise ValueError('invalid_command')
  args={} if args is None else args
  if command==LICENSE:
   if set(args)!={'sku'}:raise ValueError('unknown_module')
   view=await self.view();row=next((r for r in view['modules'] if r['sku']==args['sku']),None)
   if row is None:raise ValueError('unknown_module')
   if not row['license']['allowed']:return await self.old(command,args,active=active)
   return {**row['license'],'entitlement_type':'paid','installation_id':self.bridge.core_id,'module':row['name'],'preview':row['preview'],'path':row['path'],'trial_blocks_at':None,'verification_source':'offline_vendor_signature'}
  if args:raise ValueError('unexpected_arguments')
  view=await self.view()
  if command==STATUS:return view
  return {'online_status':'offline','verification_source':'offline_vendor_signature','modules':[{'sku':r['sku'],'allowed':r['license']['allowed'],'status':r['license']['status']} for r in view['modules']]}
 def close(self):
  self.closed=True
  if self.bridge.handle is self.dispatch:self.bridge.handle=self.old
