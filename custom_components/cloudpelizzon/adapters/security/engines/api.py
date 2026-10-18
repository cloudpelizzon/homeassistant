"""Public native WS registration for the two original management commands."""
import asyncio
import probatio
from homeassistant.components import websocket_api
from .bridge import READ,UPDATE,CONTRACTS
KEY='cloudpelizzon_security_engines_transport66'
SCHEMAS={READ:{probatio.Required('type'):READ},UPDATE:{probatio.Required('type'):UPDATE,probatio.Required('code'):str,probatio.Optional('enabled'):bool,probatio.Optional('config'):dict}}

async def dispatch(hass,connection,msg):
    user=connection.user
    if user is None or getattr(user,'is_active',False) is not True:
        connection.send_error(msg['id'],'unauthorized','Acesso indisponível.');return
    bridge=hass.data.get(KEY)
    if bridge is None:
        connection.send_error(msg['id'],'not_loaded','Segurança indisponível.');return
    try:
        result=await bridge.handle(msg['type'],{k:v for k,v in msg.items() if k not in ('id','type')},active=True,admin=getattr(user,'is_admin',False))
        if (hass.data.get(KEY) is not bridge or connection.user is not user
            or getattr(user,'is_active',False) is not True
            or msg['type']==UPDATE and getattr(user,'is_admin',False) is not True):raise PermissionError('session_or_transport_changed')
        connection.send_result(msg['id'],result)
    except asyncio.CancelledError:raise
    except Exception:connection.send_error(msg['id'],'cloud_denied_or_unavailable','Não foi possível validar a operação de Segurança no servidor.')

def register(hass,bridge):
    registry=hass.data.get(websocket_api.DOMAIN,{})
    if KEY in hass.data or any(name in registry for name in CONTRACTS):raise ValueError('existing_security_handlers')
    handlers={};hass.data[KEY]=bridge
    def close():
        bridge.close()
        if hass.data.get(KEY) is bridge:hass.data.pop(KEY,None)
        current=hass.data.get(websocket_api.DOMAIN,{})
        for name,handler in handlers.items():
            if name in current and current[name][0] is handler:current.pop(name)
    try:
        for name,schema in SCHEMAS.items():
            handler=websocket_api.websocket_command(schema)(websocket_api.async_response(dispatch))
            websocket_api.async_register_command(hass,handler);handlers[name]=handler
    except BaseException:close();raise
    return close
