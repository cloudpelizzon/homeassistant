"""Owned native HA commands retaining the original UI contracts."""
import asyncio
import probatio
from homeassistant.components import websocket_api
from .bridge import STATUS, REGISTER, PAIR, CONTRACTS

KEY = 'cloudpelizzon_onboarding74'
SCHEMAS = {STATUS: {probatio.Required('type'): STATUS},
           PAIR: {probatio.Required('type'): PAIR},
           REGISTER: {probatio.Required('type'): REGISTER,
                      probatio.Required('code'): str, probatio.Required('consent'): bool}}


async def dispatch(hass, connection, msg):
    bridge = hass.data.get(KEY)
    def authorized():
        user = connection.user
        return (bridge is not None and hass.data.get(KEY) is bridge
                and user is not None and getattr(user, 'is_active', False) is True
                and getattr(user, 'is_admin', False) is True)
    try:
        if bridge is None:
            raise PermissionError('not_loaded')
        result = await bridge.handle(msg['type'], {k: v for k, v in msg.items() if k not in ('id', 'type')},
                                     authorized=authorized)
        bridge.check(authorized)
        connection.send_result(msg['id'], result)
    except asyncio.CancelledError:
        raise
    except Exception:
        connection.send_error(msg['id'], 'handoff_denied_or_unavailable',
                              'Não foi possível confirmar o cadastro ou pareamento.')


def register(hass, bridge):
    registry = hass.data.get(websocket_api.DOMAIN, {})
    if KEY in hass.data or any(name in registry for name in CONTRACTS):
        raise ValueError('onboarding_command_conflict')
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
