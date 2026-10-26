"""Read-only camera snapshots from the consented source HA. No source services."""
import asyncio,time
from homeassistant.components.camera import Camera,CameraEntityFeature
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from .homolog_mirror.policy import DOMAIN
ADDERS=DOMAIN+'_camera_adders'
async def async_setup_entry(hass,entry,async_add_entities):
 hass.data.setdefault(ADDERS,{})[entry.entry_id]=async_add_entities

class ObservationCamera(Camera):
 _attr_has_entity_name=False
 _attr_supported_features=CameraEntityFeature(0)
 def __init__(self,mirror,eid,value,attrs):
  super().__init__();self.mirror=mirror;self.entity_id=eid;self.source_id=eid
  self._attr_unique_id='production_observation:'+eid;self._attr_name=attrs.get('friendly_name',eid)
  self.content_type='image/jpeg';self.value=value;self._last=None;self._at=0.;self._image_lock=asyncio.Lock()
 @property
 def available(self):return not self.mirror.stopping and self.value not in {'unavailable','unknown'}
 @property
 def is_on(self):return self.available and self.value!='off'
 @property
 def is_recording(self):return self.value=='recording'
 @property
 def extra_state_attributes(self):return {'cloudpelizzon_read_only':True,'mirror_source':'production_observer','mirror_original_entity_id':self.source_id}
 @property
 def device_info(self):
  # Attach to the device metadata already created by the observer.
  source=self.mirror.source_devices.get(self.source_id)
  return {'identifiers':{(DOMAIN,source)}} if source else None
 def update_source(self,value):
  self.value=value
  if self.hass is not None:self.async_write_ha_state()
 async def async_camera_image(self,width=None,height=None):
  if not self.is_on:return None
  async with self._image_lock:
   if self._last is not None and time.monotonic()-self._at<5:return self._last
   url=self.mirror.source.split('/api/')[0]+'/api/camera_proxy/'+self.source_id
   try:
    async with asyncio.timeout(10),self.mirror.image_slots:
     async with async_get_clientsession(self.hass).get(url,headers={'Authorization':'Bearer '+self.mirror.token},allow_redirects=False) as response:
      if response.status!=200 or response.headers.get('Content-Type','').split(';')[0] not in {'image/jpeg','image/png','image/webp','image/gif'}:return None
      chunks=[];size=0
      async for chunk in response.content.iter_chunked(65536):
       size+=len(chunk)
       if size>8388608:return None
       chunks.append(chunk)
      if self.mirror.stopping:return None
      raw=b''.join(chunks);self.content_type=response.headers['Content-Type'].split(';')[0]
      self._last=raw;self._at=time.monotonic();return raw
   except Exception:
    return None
