"""Native residence-mode entity. No local presence or alarm engine."""
from homeassistant.components.select import SelectEntity
from .public_security.native134 import MODE,MODES,NativeEntity,edge_for

async def async_setup_entry(hass,entry,async_add_entities):
    async_add_entities([PrivateMode(edge_for(hass))])

class PrivateMode(NativeEntity,SelectEntity):
    _attr_name='CloudPelizzon Modo da Residência'
    _attr_unique_id='cloudpelizzon_native_mode134'
    _attr_options=MODES
    def __init__(self,edge):super().__init__();self.bind(edge);self.entity_id=MODE
    @property
    def current_option(self):return (self.edge.native or {}).get('mode')
    async def async_select_option(self,option):await self.command('native.mode',{'mode':option})
