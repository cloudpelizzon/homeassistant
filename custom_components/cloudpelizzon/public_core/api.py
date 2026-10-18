"""Original Core read commands with owned native HA registration/unload."""
import asyncio
import probatio
from homeassistant.components import websocket_api
from .bridge import CONTRACTS, STATUS, LICENSE, REFRESH

KEY = 'cloudpelizzon_public_core72'
SCHEMAS = {
    STATUS: {probatio.Required('type'): STATUS},
    LICENSE: {probatio.Required('type'): LICENSE, probatio.Required('sku'): str},
    REFRESH: {probatio.Required('type'): REFRESH},
}


def active(connection):
    return connection.user is not None and getattr(connection.user, 'is_active', False) is True


async def dispatch(hass, connection, msg):
    if not active(connection):
        connection.send_error(msg['id'], 'unauthorized', 'Sessão ativa necessária.')
        return
    bridge = hass.data.get(KEY)
    if bridge is None:
        connection.send_error(msg['id'], 'not_loaded', 'CloudPelizzon indisponível.')
        return
    try:
        result = await bridge.handle(msg['type'], {k: v for k, v in msg.items() if k not in ('id', 'type')}, active=True)
        if hass.data.get(KEY) is not bridge or bridge.closed or not active(connection):
            raise PermissionError('session_or_runtime_changed')
        connection.send_result(msg['id'], result)
    except asyncio.CancelledError:
        raise
    except Exception:
        connection.send_error(msg['id'], 'cloud_denied_or_unavailable', 'Não foi possível verificar o acesso no servidor.')


def register(hass, bridge):
    registry = hass.data.get(websocket_api.DOMAIN, {})
    if KEY in hass.data or any(name in registry for name in CONTRACTS):
        raise ValueError('core_command_conflict')
    handlers = {}
    hass.data[KEY] = bridge

    def close():
        bridge.close()
        if hass.data.get(KEY) is bridge:
            hass.data.pop(KEY, None)
        current = hass.data.get(websocket_api.DOMAIN, {})
        for name, handler in handlers.items():
            if name in current and current[name][0] is handler:
                current.pop(name)

    try:
        for name, schema in SCHEMAS.items():
            handler = websocket_api.websocket_command(schema)(websocket_api.async_response(dispatch))
            websocket_api.async_register_command(hass, handler)
            handlers[name] = handler
    except BaseException:
        close()
        raise
    return close
