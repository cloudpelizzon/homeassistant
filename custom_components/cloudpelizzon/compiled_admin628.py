"""Maintain original installer UI commands; never restore plaintext engines."""
import asyncio,json
from functools import partial
from homeassistant.components import websocket_api
import probatio as vol
from .compiled_release628 import RELEASES

def attach(hass,entry,context,registration,root):
 STATUS='cloudpelizzon/private_modules/status';INSTALL='cloudpelizzon/private_modules/install';owned={};closed=[False]
 def guard(connection):
  user=connection.user
  if closed[0] or registration.closed or user is None or not user.is_active or not user.is_admin:raise PermissionError('active_administrator_required')
 async def dispatch(hass,connection,msg):
  try:
   guard(connection);sku=msg['sku']
   if sku not in RELEASES:raise PermissionError('compiled_module_not_available')
   if msg['type']==INSTALL:
    if msg['confirmed'] is not True:raise PermissionError('explicit_installation_required')
    from .compiled_bootstrap628 import provision
    await hass.async_add_executor_job(partial(provision,root,context,force=sku));guard(connection)
    if sku=='CP-INVENTORY':
     runtime=hass.data['cloudpelizzon_inventory506'];packet=json.loads((root/sku/'inventory-entitlement.json').read_bytes())
     await hass.async_add_executor_job(runtime.engine.install_license,packet)
    result={'installed':True,'engine_mode':'local','reused':True,'compiled':True,'core_restart_required':False}
   else:
    runtime=registration.runtimes.get(sku)
    if runtime is not None:await hass.async_add_executor_job(runtime.namespace.guard.verify,sku,runtime.iid)
    else:await hass.async_add_executor_job(hass.data['cloudpelizzon_inventory506'].engine.entitlement)
    result={'mode':'local','can_install':False,'installed':True,'engine_mode':'local','compiled':True,'message':'Motor compilado instalado; licença verificada localmente.'}
   guard(connection);connection.send_result(msg['id'],result)
  except asyncio.CancelledError:raise
  except Exception:connection.send_error(msg['id'],'compiled_access_unavailable','Não foi possível confirmar o acesso ao motor local. Os dados foram preservados.')
 for name in (STATUS,INSTALL):
  if name in hass.data.get(websocket_api.DOMAIN,{}):raise PermissionError('installer_command_already_owned')
  schema={vol.Required('type'):name,vol.Required('sku'):str}
  if name==INSTALL:schema[vol.Required('confirmed')]=bool
  fn=websocket_api.websocket_command(schema)(websocket_api.async_response(dispatch));websocket_api.async_register_command(hass,fn);owned[name]=fn
 def close():
  closed[0]=True;registry=hass.data.get(websocket_api.DOMAIN,{})
  for name,fn in owned.items():
   if name in registry and registry[name][0] is fn:registry.pop(name)
 return close
