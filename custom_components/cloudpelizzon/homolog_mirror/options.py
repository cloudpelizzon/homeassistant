"""Local-only options for consented read-only production observations."""
import asyncio
import re
import aiohttp
import probatio as vol
from homeassistant import config_entries
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.selector import TextSelector,TextSelectorConfig,TextSelectorType
from homeassistant.helpers.storage import Store
from .policy import STORE,source_url,outgoing,check_peer
from . import start_saved

async def verify(hass,source,token):
 async with asyncio.timeout(15):
  async with async_get_clientsession(hass).ws_connect(source,heartbeat=30,max_msg_size=16777216) as ws:
   check_peer(str(ws._response.url),source)
   if (await ws.receive_json()).get('type')!='auth_required':raise ValueError('unexpected_source')
   await ws.send_json(outgoing('auth',token=token))
   if (await ws.receive_json()).get('type')!='auth_ok':raise ValueError('invalid_auth')
   for i,kind in enumerate(('get_states','config/device_registry/list','config/entity_registry/list'),1):
    await ws.send_json(outgoing(kind,id=i));row=await ws.receive_json()
    if row.get('id')!=i or not row.get('success'):raise ValueError('read_permission_denied')

class HomologOptionsFlow(config_entries.OptionsFlow):
 async def async_step_init(self,user_input=None):
  store=Store(self.hass,1,STORE,private=True,atomic_writes=True);saved=await store.async_load() or {};errors={}
  if user_input is not None:
   if user_input.get('enabled') is not True:
    await store.async_save({'enabled':False});await start_saved(self.hass,self.config_entry)
    return self.async_create_entry(title='',data=dict(self.config_entry.options))
   try:
    base=user_input.get('source_url','').strip();source=source_url(base)
    token=user_input.get('token','').strip()
    if not token:
     if source!=source_url(saved.get('source_base','')):raise ValueError('new_source_requires_token')
     token=saved.get('token','')
    if not token:raise ValueError('token_required')
    core=await Store(self.hass,1,'cloudpelizzon_core.data',private=True).async_load()
    iid=core.get('installation_id') if isinstance(core,dict) else None
    if not isinstance(iid,str) or not re.fullmatch('[0-9a-f]{32}',iid) or iid!=self.config_entry.data.get('fleet_installation_id'):raise ValueError('target_identity_invalid')
    await verify(self.hass,source,token)
   except (ValueError,aiohttp.ClientError,TimeoutError):errors['base']='mirror_cannot_connect'
   else:
    await store.async_save({'enabled':True,'source_base':base,'token':token,'target_core':iid,'forward_commands':user_input.get('forward_commands') is True})
    await start_saved(self.hass,self.config_entry)
    return self.async_create_entry(title='',data=dict(self.config_entry.options))
  return self.async_show_form(step_id='init',data_schema=vol.Schema({
   vol.Required('enabled',default=saved.get('enabled',False)):bool,
   vol.Optional('forward_commands',default=saved.get('forward_commands',False)):bool,
   vol.Optional('source_url',default=saved.get('source_base','')):str,
   vol.Optional('token'):TextSelector(TextSelectorConfig(type=TextSelectorType.PASSWORD)),
  }),errors=errors)
