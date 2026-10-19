"""HA entity transport only. All alarm and occupancy decisions stay private."""
from homeassistant.exceptions import HomeAssistantError
from .api126 import KEY

ALARM='alarm_control_panel.cloudpelizzon_security_internal'
MODE='select.cloudpelizzon_security_mode'
MODES=['Casa','Ausente','Dormindo','Viagem','Férias','Visitantes']

class NativeEntity:
    _attr_should_poll=False
    _attr_has_entity_name=False
    def bind(self,edge):self.edge=edge
    @property
    def available(self):
        at=self.edge.native_at
        return (not self.edge.closed and self.edge.connected and self.edge.native is not None
                and at is not None and 0<=(self.edge.clock()-at).total_seconds()<6)
    async def async_added_to_hass(self):
        await super().async_added_to_hass()
        self.edge.native_listeners.add(self.async_write_ha_state)
        self.async_on_remove(lambda:self.edge.native_listeners.discard(self.async_write_ha_state))
    async def command(self,action,payload):
        uid=getattr(getattr(self,'_context',None),'user_id',None)
        user=await self.hass.auth.async_get_user(uid) if uid else None
        if uid and (user is None or not user.is_active or not user.is_admin):
            raise HomeAssistantError('Administrador necessário para controlar a central virtual.')
        def authorized():return not self.edge.closed and (uid is None or user.is_active and user.is_admin)
        try:await self.edge.native_command(action,payload,authorized=authorized)
        except Exception:raise HomeAssistantError('Central virtual indisponível. Confira trial, conexão e configuração dos sensores.') from None
    @property
    def extra_state_attributes(self):
        value=self.edge.native or {}
        return {'cloudpelizzon_native_security':True,'house_mode':value.get('mode'),
                'configured_sensors':value.get('configured_sensors',0),'occupancy':value.get('occupancy'),'pending':value.get('pending'),
                'faults':value.get('faults',[]),'revision':value.get('revision'),
                'events':value.get('events',[])[-10:],'controller':'private_authorized_runtime'}

def edge_for(hass):return hass.data[KEY]
