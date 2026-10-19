"""Original Solar WebSocket names, delegated to the private engine transport."""
import asyncio,inspect
import probatio
from homeassistant.components import websocket_api
from .bridge import COMMANDS
KEY='cloudpelizzon_solar45'
SOURCE='cloudpelizzon/energy/production_config'
HISTORY='cloudpelizzon/energy/production_history'
EXTRA={SOURCE,HISTORY}

def _owned(current,original):
    if current is original:return True
    # The unchanged original Core wraps commercial WS handlers after module
    # setup. Remove that wrapper on unload only when its closure still points
    # to this exact handler; never remove an unrelated replacement.
    if not getattr(current,'_cp_commercial_guard',False) or getattr(current,'_cp_commercial_sku',None)!='CP-SOLAR':return False
    wrapped=getattr(current,'__wrapped__',None)
    if not inspect.isfunction(wrapped) or not wrapped.__module__.endswith('.core.commercial_guard'):return False
    return inspect.getclosurevars(wrapped).nonlocals.get('handler') is original

async def dispatch(hass,connection,msg):
    user=connection.user
    if user is None or user.is_active is not True:
        connection.send_error(msg['id'],'unauthorized','Acesso indisponível.');return
    bridge=hass.data.get(KEY)
    if bridge is None:
        connection.send_error(msg['id'],'not_loaded','Solar indisponível.');return
    try:
        if msg['type'] in EXTRA:
            if not user.is_admin:raise PermissionError('admin_required')
            await bridge.handle('cloudpelizzon/energy/status',{},admin=True)
            from ...homolog_mirror.source132 import observer,request,measurement_config,energy_history
            if msg['type']==SOURCE:result={'config':measurement_config(await request(observer(hass), 'cloudpelizzon/energy/config/get'))}
            else:
                config=await bridge.handle('cloudpelizzon/energy/config/get',{},admin=True)
                allowed=set()
                def collect(value):
                    if isinstance(value,dict):
                        for item in value.values():collect(item)
                    elif isinstance(value,list):
                        for item in value:collect(item)
                    elif isinstance(value,str) and value.startswith('sensor.'):allowed.add(value)
                collect(config)
                result=await energy_history(hass,msg['query'],allowed)
        else:
            result=await bridge.handle(msg['type'],{k:v for k,v in msg.items() if k not in ('id','type')},admin=user.is_admin)
        if hass.data.get(KEY) is not bridge:raise PermissionError('bridge_unloaded')
        connection.send_result(msg['id'],result)
    except asyncio.CancelledError:raise
    except Exception:
        connection.send_error(msg['id'],'cloud_denied_or_unavailable','Não foi possível validar a operação Solar no servidor.')

def register(hass,bridge):
    if KEY in hass.data:raise ValueError('solar_bridge_already_registered')
    registry=hass.data.get(websocket_api.DOMAIN,{})
    if any(command in registry for command in set(COMMANDS)|EXTRA):raise ValueError('legacy_handlers_must_be_unloaded_first')
    handlers={}
    for command in set(COMMANDS)|EXTRA:
        schema={probatio.Required('type'):command}
        if command==HISTORY:schema[probatio.Required('query')]=dict
        if command.endswith('/config/save'):schema[probatio.Required('config_json')]=str
        handler=websocket_api.websocket_command(schema)(websocket_api.async_response(dispatch))
        websocket_api.async_register_command(hass,handler);handlers[command]=handler
    hass.data[KEY]=bridge
    def unload():
        if hass.data.get(KEY) is not bridge:return
        bridge.close();hass.data.pop(KEY,None)
        registry=hass.data.get(websocket_api.DOMAIN,{})
        for command,handler in handlers.items():
            if command in registry and _owned(registry[command][0],handler):registry.pop(command)
    return unload
