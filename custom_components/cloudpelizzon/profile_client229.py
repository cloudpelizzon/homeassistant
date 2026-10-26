"""Signed license/customer display and Release Center reads. Never grants execution."""
import asyncio,base64,hashlib,http.client,json,secrets,time
from datetime import datetime,timezone
from pathlib import Path
from cryptography.hazmat.primitives import hashes,serialization
from cryptography.hazmat.primitives.asymmetric import padding
import probatio
from homeassistant.components import websocket_api
from .private_protocol216 import SIGNER_SHA256,canonical

def post(path,value):
 c=http.client.HTTPSConnection('portal.cloudpelizzon.com.br',timeout=12)
 try:
  c.request('POST',path,canonical(value),{'Content-Type':'application/json'});r=c.getresponse();raw=r.read(131073)
  if r.status!=200 or len(raw)>131072:raise PermissionError('profile_transport_unavailable')
  return json.loads(raw)
 finally:c.close()
KEY='cloudpelizzon_profile229';PROFILE='cloudpelizzon/core/license/details'

def fetch(context):
 client=context['client'];nonce=secrets.token_hex(32)
 request=client._sign({'installation_id':context['trial_id'],'timestamp':int(time.time()),'nonce':nonce},b'CP-LICENSE-DISPLAY228\n')
 packet=post('/custom/cloudpelizzon/license_profile228.php',request)
 if type(packet) is not dict or set(packet)!={'profile','public_key','signature'}:raise PermissionError('profile_shape_invalid')
 der=base64.b64decode(packet['public_key'],validate=True)
 if hashlib.sha256(der).hexdigest()!=SIGNER_SHA256:raise PermissionError('profile_signer_changed')
 body=packet['profile'];serialization.load_der_public_key(der).verify(base64.b64decode(packet['signature'],validate=True),b'CP-LICENSE-PROFILE228\n'+canonical(body),padding.PKCS1v15(),hashes.SHA256())
 now=time.time()
 if body.get('schema')!='cp.license.profile228.v1' or body.get('installation_id')!=context['trial_id'] or body.get('core_id')!=context['core_id'] or body.get('nonce')!=nonce or not body['issued_at']-2<=now<body['expires_at']<=body['issued_at']+30:raise PermissionError('profile_binding_invalid')
 return body

class Display:
 def __init__(self,hass,context):self.hass=hass;self.context=context;self.closed=False;self.lock=asyncio.Lock();self.cached=None
 async def profile(self):
  async with self.lock:
   now=time.time()
   if self.cached is not None and self.cached['issued_at']-2<=now<self.cached['expires_at']-1:return self.cached
   body=await self.hass.async_add_executor_job(fetch,self.context)
   if self.closed:raise PermissionError('profile_unloaded')
   self.cached=body;return body
 async def updates(self):
  body=await self.profile()
  licensed={r['sku'] for r in body['licenses'] if r['active']}
  from . import ha_private212 as loader
  local='CP-SOLAR' in licensed and await loader.async_prepare(self.hass)
  components=[]
  if local:
   def info():
    # The installed manifest was verified by async_prepare; return display metadata only.
    envelope=json.loads((Path(__file__).resolve().parent/'_paid_modules/solar/manifest.json').read_bytes())
    manifest=envelope.get('manifest',{})
    return {'sku':'CP-SOLAR','name':'Inteligência Solar','version':str(manifest.get('version','1.0.0')),'engine_mode':'local','signature_verified':True}
   components.append(await self.hass.async_add_executor_job(info))
  # CP_COMPONENTS470: license visibility is independent of a local paid archive.
  names={'CP-SOLAR':'Inteligência Solar','CP-MAINTENANCE':'Manutenção Residencial Preventiva','CP-SECURITY-PRO':'Central de Segurança Pro','CP-SECURITY':'Central de Segurança','CP-AUTOMATION':'Central Inteligente de Automações','CP-LIGHTING':'Iluminação'}
  for component in components:component.update(license_active=True,installed=True)
  present={component['sku'] for component in components}
  for sku in sorted(licensed):
   if sku not in present and sku in names:
    components.append({'sku':sku,'name':names[sku],'version':None,'engine_mode':'license_only','signature_verified':False,'installed':False,'license_active':True})
  return {'schema':'cp.private.updater229.v1','channel':'stable','checked_at':datetime.now(timezone.utc).isoformat(),
      'components':components,'catalog_releases':body['published_releases'],
      'licensed_modules':sorted(licensed),'releases':[],'backups':[],
      'message':'Consulta concluída ao Release Center. A compatibilidade das publicações com o pacote local é conferida antes de disponibilizar uma instalação.'}

# CP_LIGHTING_READ_OBSERVER233: diagnostics only; preserve the original signed port.
def observe_lighting233(hass):
 import logging
 transport=hass.data.get('cloudpelizzon_lighting_native_v1')
 if transport is None:return lambda:None
 port=transport.port;original=port._run;last={}
 async def observed_run(fn,*args):
  def observed(*values):
   try:return fn(*values)
   except Exception as exc:
    now=time.monotonic();name=getattr(fn,'__name__','operation')
    if now-last.get(name,-1000)>20:
     last[name]=now
     text=str(exc);code=text if text in {'lighting_unavailable','lighting_result_denied','lighting_result_binding','lighting_result_expired','status_not_verified','transport_failed','authority_unavailable','capability_invalid','licensed_module_requires_local_installation'} or text in {'request_denied_http_'+str(n) for n in (400,401,403,404,413,422,429,500,501,503)} else type(exc).__name__
     frames=[];tb=exc.__traceback__
     while tb is not None:
      frames.append({'file':Path(tb.tb_frame.f_code.co_filename).name,'function':tb.tb_frame.f_code.co_name,'line':tb.tb_lineno});tb=tb.tb_next
     logging.getLogger(__name__).warning('CP_LIGHTING_READ233 %s',json.dumps({'stage':name,'code':code,'frames':frames[-6:],'credentials_displayed':False},separators=(',',':')))
    raise
  return await original(observed,*args)
 port._run=observed_run
 def close():
  if port._run is observed_run:port._run=original
 return close

def register(hass,context):
 if KEY in hass.data:raise ValueError('profile_handler_conflict')
 stop_observer233=observe_lighting233(hass)
 state=Display(hass,context);hass.data[KEY]=state;handlers={};registry=hass.data.get(websocket_api.DOMAIN,{})
 from .lighting_sync239 import Sync
 sync=Sync(hass)
 from .lighting_controls240 import register as register_controls240
 stop_controls240=register_controls240(hass)
 sync_names=('cloudpelizzon/lighting/sync239/preview','cloudpelizzon/lighting/sync239/step')
 diagnostic='cloudpelizzon/lighting/read_diagnostic235'
 names=(PROFILE,'cloudpelizzon/private_updater/status','cloudpelizzon/private_updater/check',diagnostic,*sync_names)
 async def handler(hass,connection,msg):
  user=connection.user
  if user is None or not user.is_active or (msg['type'] in (PROFILE,diagnostic,*sync_names) and not user.is_admin):connection.send_error(msg['id'],'unauthorized','Permissão insuficiente.');return
  try:
   if msg['type'] in sync_names:
    result=await sync.run(connection,mutate=msg['type']==sync_names[1])
   elif msg['type']==diagnostic:
    from .lighting_diagnostic235 import diagnose
    result=await diagnose(hass,connection)
   else:result=await (state.profile() if msg['type']==PROFILE else state.updates())
   current=await hass.auth.async_get_user(user.id)
   if state.closed or connection.user is not user or current is None or not current.is_active or (msg['type'] in (PROFILE,diagnostic,*sync_names) and not current.is_admin):raise PermissionError('profile_session_changed')
   connection.send_result(msg['id'],result)
  except asyncio.CancelledError:raise
  except Exception:connection.send_error(msg['id'],'profile_or_release_center_unavailable','Não foi possível consultar o cadastro ou o Release Center agora. Tente novamente em alguns instantes.')
 def close():
  stop_observer233()
  stop_controls240()
  sync.closed=True
  state.closed=True
  if hass.data.get(KEY) is state:hass.data.pop(KEY,None)
  reg=hass.data.get(websocket_api.DOMAIN,{})
  for name,fn in handlers.items():
   if name in reg and reg[name][0] is fn:reg.pop(name)
 try:
  for name in names:
   if name in registry:raise ValueError('existing_profile_or_updater_handler')
   fn=websocket_api.websocket_command({probatio.Required('type'):name})(websocket_api.async_response(handler))
   websocket_api.async_register_command(hass,fn);handlers[name]=fn
 except BaseException:close();raise
 return close
