"""Native HA alarm entity backed exclusively by the authorized private runtime."""
from homeassistant.components.alarm_control_panel import AlarmControlPanelEntity,AlarmControlPanelEntityFeature,AlarmControlPanelState
from .public_security.native134 import ALARM,NativeEntity,edge_for

async def async_setup_entry(hass,entry,async_add_entities):
    async_add_entities([PrivateAlarm(edge_for(hass))])

class PrivateAlarm(NativeEntity,AlarmControlPanelEntity):
    _attr_name='CloudPelizzon Central Virtual'
    _attr_unique_id='cloudpelizzon_native_alarm134'
    _attr_code_arm_required=False
    _attr_supported_features=AlarmControlPanelEntityFeature.ARM_HOME|AlarmControlPanelEntityFeature.ARM_AWAY|AlarmControlPanelEntityFeature.TRIGGER
    def __init__(self,edge):super().__init__();self.bind(edge);self.entity_id=ALARM
    @property
    def alarm_state(self):
        name=(self.edge.native or {}).get('alarm','unknown')
        if name=='panic':name='triggered'
        try:return AlarmControlPanelState(name)
        except ValueError:return None
    async def async_alarm_arm_home(self,code=None):await self.command('alarm.arm_home',{})
    async def async_alarm_arm_away(self,code=None):await self.command('alarm.arm_away',{})
    async def async_alarm_disarm(self,code=None):await self.command('alarm.disarm',{})
    async def async_alarm_trigger(self,code=None):await self.command('alarm.panic',{})
