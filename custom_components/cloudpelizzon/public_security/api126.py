"""Explicit permissions and signed manual commands for Security administrators."""
import asyncio
import probatio
from homeassistant.components import websocket_api
READ='cloudpelizzon/security/permissions'
SAVE='cloudpelizzon/security/permissions/save'
MANUAL='cloudpelizzon/security/command'
NATIVE='cloudpelizzon/security/native'
KEY='cloudpelizzon_security_connection126'
SCHEMAS={READ:{probatio.Required('type'):READ},SAVE:{probatio.Required('type'):SAVE,probatio.Required('policy'):dict,probatio.Required('confirmed'):bool},
 MANUAL:{probatio.Required('type'):MANUAL,probatio.Required('service'):str,probatio.Required('data'):dict},NATIVE:{probatio.Required('type'):NATIVE,probatio.Required('action'):str,probatio.Required('payload'):dict}}

async def dispatch(hass,connection,msg):
 user=connection.user;edge=hass.data.get(KEY)
 def authorized():return (hass.data.get(KEY) is edge and connection.user is user and user is not None
  and getattr(user,'is_active',False) is True and getattr(user,'is_admin',False) is True and not edge.closed)
 if user is not None:authorized.actor_id=user.id
 if edge is None or not authorized():
  connection.send_error(msg['id'],'unauthorized','Administrador necessário.');return
 try:
  if msg['type']==READ:result={'policy':edge.check(),'connected':edge.connected,'fault':edge.fault}
  elif msg['type']==SAVE:
   if msg['confirmed'] is not True:raise PermissionError('explicit_consent_required')
   result=await edge.prepare(new_policy=msg['policy'],confirmed=True,authorized=authorized)
  elif msg['type']==NATIVE:
   result=await edge.native_command(msg['action'],msg['payload'],authorized=authorized)
  elif msg['type']==MANUAL:
   result=await edge.manual(msg['service'],msg['data'],authorized=authorized)
   from ..homolog_mirror.source132 import observer
   try:detail=getattr(observer(hass),'last_command',None)
   except PermissionError:detail=None
   if detail and detail.get('entity_id')==msg['data'].get('entity_id') and detail.get('service')==msg['service']:result={**result,'production':detail}
  else:raise ValueError('unknown_command')
  if not authorized():raise PermissionError('session_changed')
  connection.send_result(msg['id'],result)
 except asyncio.CancelledError:raise
 except Exception:
  message='Operação não confirmada. Verifique conexão, licença e permissões de Segurança.'
  if msg['type']==MANUAL:
   from ..homolog_mirror.source132 import observer
   import time
   try:detail=getattr(observer(hass),'last_command',None)
   except PermissionError:detail=None
   if detail and time.time()-detail.get('at',0)<30 and detail.get('entity_id')==msg['data'].get('entity_id') and detail.get('service')==msg['service']:
    if detail.get('outcome')=='no_state_change':message=f"A produção recebeu a chamada, mas {detail['entity_id']} continuou em {detail.get('after')}. A ação não foi confirmada e não será repetida automaticamente."
    elif detail.get('outcome')=='source_rejected':message=f"O Home Assistant de produção recusou o comando (HTTP {detail.get('http_status')}). A ação não foi confirmada."
    elif detail.get('outcome')=='source_unavailable':message=f"{detail['entity_id']} está {detail.get('after')} no Home Assistant de produção. Nenhum comando foi enviado."
  connection.send_error(msg['id'],'cloud_denied_or_unavailable',message)

def register(hass,edge):
 current=hass.data.get(websocket_api.DOMAIN,{})
 if KEY in hass.data or any(name in current for name in SCHEMAS):raise ValueError('security_connection_conflict')
 hass.data[KEY]=edge;handlers={}
 def close():
  if hass.data.get(KEY) is edge:hass.data.pop(KEY,None)
  current=hass.data.get(websocket_api.DOMAIN,{})
  for name,handler in handlers.items():
   if name in current and current[name][0] is handler:current.pop(name)
 try:
  for name,schema in SCHEMAS.items():
   handler=websocket_api.websocket_command(schema)(websocket_api.async_response(dispatch))
   websocket_api.async_register_command(hass,handler);handlers[name]=handler
 except BaseException:close();raise
 return close
