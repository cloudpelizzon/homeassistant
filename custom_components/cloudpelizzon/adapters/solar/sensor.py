"""Public HA entities publish server values; no integration or discovery math."""
from homeassistant.components.sensor import SensorEntity,SensorDeviceClass,SensorStateClass

async def async_setup_entry(hass,entry,async_add_entities):
    runtime=hass.data.get('cloudpelizzon',{}).get('energy',{})
    controller=runtime.get('remote_controller') if isinstance(runtime,dict) else None
    if controller is None:return
    controller.bind(async_add_entities)
    try:await controller.refresh()
    except Exception:
        # Registry/transport failures leave values unavailable. The original
        # frontend remains registered and each subsequent operation reauthorizes.
        import logging
        logging.getLogger(__name__).warning('Solar remote startup unavailable; no local engine fallback')

class SolarSensor(SensorEntity):
    _attr_should_poll=False
    def __init__(self,mirror,descriptor):
        self.mirror=mirror;self.entity_id=descriptor['entity_id'];self._attr_unique_id=descriptor['unique_id'];self._attr_name=descriptor['name'];self._attr_icon=descriptor['icon']
        energy=descriptor['kind']=='energy'
        self._attr_device_class=SensorDeviceClass.ENERGY if energy else SensorDeviceClass.POWER
        self._attr_native_unit_of_measurement='kWh' if energy else 'W'
        self._attr_state_class=SensorStateClass.TOTAL_INCREASING if energy else SensorStateClass.MEASUREMENT
    @property
    def device_info(self):
        platform=getattr(self,'platform',None)
        if platform is None or platform.config_entry is None:return None
        return {'identifiers':{('cloudpelizzon','cp-energy')},'name':'CloudPelizzon Energia','manufacturer':'CloudPelizzon','model':'CP-ENERGY','sw_version':'1.0.0'}
    @property
    def available(self):
        row=self.mirror.row(self.entity_id)
        return bool(row is not None and row['value'] is not None)
    @property
    def native_value(self):
        row=self.mirror.row(self.entity_id)
        return row['value'] if row else None
    @property
    def extra_state_attributes(self):
        row=self.mirror.row(self.entity_id)
        return row['attributes'] if row else {}
    async def async_added_to_hass(self):
        await super().async_added_to_hass()
        self.async_on_remove(self.mirror.subscribe(self.async_write_ha_state))
