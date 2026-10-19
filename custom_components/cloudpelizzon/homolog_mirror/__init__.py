"""Homologation-only live observations. No service forwarding or source writes."""
import asyncio,json,logging
import aiohttp
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr,entity_registry as er
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from .policy import DOMAIN,STORE,clean,outgoing,check_peer,source_url
_LOGGER=logging.getLogger(__name__)

async def stop(hass,entry,*,unload_platform=False):
 mirror=hass.data.get(DOMAIN,{}).pop(entry.entry_id,None)
 if mirror is not None:
  mirror.stopping=True
  if mirror.task is not None:
   mirror.task.cancel()
   try:await mirror.task
   except asyncio.CancelledError:pass
  if not unload_platform:
   for camera in mirror.cameras.values():
    if camera.hass is not None:await camera.async_remove()
  for eid in mirror.owned:
   state=hass.states.get(eid)
   if state and state.attributes.get('mirror_source')=='production_observer':hass.states.async_remove(eid)
  hass.states.async_remove('sensor.cloudpelizzon_homolog_mirror')
 if unload_platform:
  from ..camera import ADDERS
  if entry.entry_id in hass.data.get(ADDERS,{}):
   await hass.config_entries.async_unload_platforms(entry,['camera']);hass.data[ADDERS].pop(entry.entry_id,None)

async def start_saved(hass,entry):
 from homeassistant.helpers.storage import Store
 await stop(hass,entry)
 saved=await Store(hass,1,STORE,private=True,atomic_writes=True).async_load()
 if not isinstance(saved,dict) or saved.get('enabled') is not True:return
 core=await Store(hass,1,'cloudpelizzon_core.data',private=True).async_load()
 if not isinstance(core,dict) or core.get('installation_id')!=saved.get('target_core') or core.get('installation_id')!=entry.data.get('fleet_installation_id'):
  _LOGGER.error('Mirror refused: local identity changed');return
 source=source_url(saved['source_base'])
 mirror=Mirror(hass,entry,saved['token'],source);mirror.forward_commands=saved.get('forward_commands') is True;hass.data.setdefault(DOMAIN,{})[entry.entry_id]=mirror
 from ..camera import ADDERS
 if entry.entry_id not in hass.data.get(ADDERS,{}):await hass.config_entries.async_forward_entry_setups(entry,['camera'])
 mirror.task=entry.async_create_background_task(hass,mirror.run(),'Production observations',eager_start=False)

class Mirror:
 def __init__(self,hass,entry,token,source):
  self.cameras={};self.source_devices={};self.image_slots=asyncio.Semaphore(3)
  self.token=token;self.source=source;self.forward_commands=False;self.commands_forwarded=0
  self.hass=hass;self.entry=entry;self.owned=set();self.blocked=set();self.mapping={};self.stopping=False;self.task=None
 def status(self,state):
  self.hass.states.async_set('sensor.cloudpelizzon_homolog_mirror',state,{'friendly_name':'Espelho da produção', 'forward_commands':self.forward_commands,'entities':len(self.owned),'collisions_skipped':len(self.blocked),'source':self.source.split('/api/')[0],'commands_forwarded':self.commands_forwarded,'last_command':getattr(self,'last_command',None)})
 def offline(self):
  for eid in self.owned:
   if eid in self.cameras:self.cameras[eid].update_source('unavailable');continue
   st=self.hass.states.get(eid)
   if st and st.attributes.get('mirror_source')=='production_observer':self.hass.states.async_set(eid,'unavailable',dict(st.attributes))
  self.status('disconnected')
 def apply(self,row):
  sanitized=clean(row)
  if sanitized is None:return
  eid,value,attrs=sanitized
  attrs['cloudpelizzon_read_only']=not self.forward_commands
  attrs['cloudpelizzon_forward_commands']=self.forward_commands
  if eid in self.blocked or (eid not in self.owned and len(self.owned)>=10000):return
  existing=self.hass.states.get(eid)
  registry=er.async_get(self.hass);reg=registry.async_get(eid)
  owned_registry=bool(reg and reg.config_entry_id==self.entry.entry_id and ((reg.platform==DOMAIN and reg.unique_id==eid) or (eid.startswith('camera.') and reg.unique_id=='production_observation:'+eid)))
  if (existing and eid not in self.owned and not owned_registry and not (reg and reg.config_entry_id==self.entry.entry_id and existing.attributes.get('mirror_source')=='production_observer')) or (reg and reg.config_entry_id!=self.entry.entry_id):self.blocked.add(eid);return
  if eid.startswith('camera.'):
   from ..camera import ADDERS,ObservationCamera
   if eid in self.cameras:self.cameras[eid].update_source(value);return
   add=self.hass.data.get(ADDERS,{}).get(self.entry.entry_id)
   if add is not None:
    # Migrate only observer-owned placeholder registry rows from alpha.28.
    if reg and reg.platform==DOMAIN and reg.unique_id==eid:
     registry.async_remove(eid)
     if existing:self.hass.states.async_remove(eid)
    camera=ObservationCamera(self,eid,value,attrs);self.cameras[eid]=camera;self.owned.add(eid);add([camera]);return
  if not reg:
   original=self.mapping.get(eid,{})
   reg=registry.async_get_or_create(eid.split('.')[0],DOMAIN,eid,config_entry=self.entry,suggested_object_id=eid.split('.',1)[1],original_name=attrs.get('friendly_name'),device_id=original.get('device_id'),original_device_class=attrs.get('device_class'),original_icon=attrs.get('icon'))
   if reg.entity_id!=eid:self.blocked.add(eid);return
  self.owned.add(eid);self.hass.states.async_set(eid,value,attrs)
 async def run(self):
  while not self.stopping:
   try:await self.connect()
   except asyncio.CancelledError:raise
   except Exception:
    # Do not log source payloads, tokens or full exception URLs.
    _LOGGER.warning('Production observation connection unavailable; retry in 15 seconds')
   self.offline();await asyncio.sleep(15)
 async def connect(self):
  session=async_get_clientsession(self.hass)
  async with session.ws_connect(self.source,heartbeat=30,receive_timeout=90,max_msg_size=16777216) as ws:
   check_peer(str(ws._response.url),self.source)
   async def recv():
    msg=await ws.receive()
    if msg.type!=aiohttp.WSMsgType.TEXT:raise ConnectionError('source_disconnected')
    return json.loads(msg.data)
   if (await recv()).get('type')!='auth_required':raise ConnectionError('unexpected_source')
   await ws.send_json(outgoing('auth',token=self.token))
   if (await recv()).get('type')!='auth_ok':raise ConnectionError('authentication_failed')
   # Subscribe first; replay events after snapshot so no changes are missed.
   buffered=[]
   async def request(kind,i):
    await ws.send_json(outgoing(kind,id=i))
    for _ in range(20000):
     row=await recv()
     if row.get('type')=='event':
      if len(buffered)>=10000:raise ConnectionError('event_buffer_limit')
      buffered.append(row)
     elif row.get('id')==i:
      if not row.get('success'):raise ConnectionError('source_request_denied')
      return row.get('result')
    raise ConnectionError('source_request_limit')
   await request('subscribe_events',1)
   devices=await request('config/device_registry/list',2)
   entities=await request('config/entity_registry/list',3)
   if not isinstance(devices,list) or len(devices)>5000 or not isinstance(entities,list) or len(entities)>10000:raise ConnectionError('registry_limit')
   device_ids={};registry=dr.async_get(self.hass)
   for dev in devices:
    source_id=dev.get('id')
    if not isinstance(source_id,str):continue
    data={k:dev[k][:150] for k in ('name','manufacturer','model','sw_version') if isinstance(dev.get(k),str)}
    local=registry.async_get_or_create(config_entry_id=self.entry.entry_id,identifiers={(DOMAIN,source_id)},**data);device_ids[source_id]=local.id
   self.source_devices={e['entity_id']:e.get('device_id') for e in entities if isinstance(e,dict) and isinstance(e.get('entity_id'),str)}
   self.mapping={e['entity_id']:{'device_id':device_ids.get(e.get('device_id'))} for e in entities if isinstance(e,dict) and isinstance(e.get('entity_id'),str) and e.get('platform') not in {'cloudpelizzon',DOMAIN}}
   excluded={e['entity_id'] for e in entities if isinstance(e,dict) and e.get('platform')=='cloudpelizzon'}
   self.blocked.update(excluded)
   rows=await request('get_states',4)
   if not isinstance(rows,list) or len(rows)>10000:raise ConnectionError('state_limit')
   live=set()
   for row in rows:
    if isinstance(row,dict):live.add(row.get('entity_id'));self.apply(row)
   for eid in self.owned-live:
    st=self.hass.states.get(eid)
    if st:self.hass.states.async_set(eid,'unavailable',dict(st.attributes))
   def event(row):
    data=row.get('event',{}).get('data',{});state=data.get('new_state');eid=data.get('entity_id')
    if state is not None:self.apply(state)
    elif eid in self.owned:
     st=self.hass.states.get(eid)
     if st:self.hass.states.async_set(eid,'unavailable',dict(st.attributes))
   for row in buffered:event(row)
   self.status('connected')
   while True:
    row=await recv()
    if row.get('type')=='event':event(row)
