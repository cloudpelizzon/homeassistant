"""Owned native HA commands retaining the original UI contracts."""
import asyncio
import probatio
from homeassistant.components import websocket_api
from .bridge import STATUS, GET, SETTINGS, CONTRACTS as READ_CONTRACTS
from .editor import CREATE, VALIDATE, SAVE, DELETE, EDITOR_CONTRACTS
from .execution124 import ACTIVATE,DEACTIVATE,PERMISSIONS,APPROVE,CONTRACTS as EXECUTION_CONTRACTS
DAILY='cloudpelizzon/automation/daily_counts'
CONTRACTS = READ_CONTRACTS | EDITOR_CONTRACTS | EXECUTION_CONTRACTS | {DAILY}

KEY = 'cloudpelizzon_automation76'
SCHEMAS = {
    DAILY: {probatio.Required('type'):DAILY},
    STATUS: {probatio.Required('type'): STATUS},
    GET: {probatio.Required('type'): GET, probatio.Required('code'): str},
    SETTINGS: {probatio.Required('type'): SETTINGS, probatio.Required('settings'): dict},
    CREATE: {probatio.Required('type'): CREATE, probatio.Required('rule'): dict},
    VALIDATE: {probatio.Required('type'): VALIDATE, probatio.Required('code'): str, probatio.Required('rule'): dict},
    SAVE: {probatio.Required('type'): SAVE, probatio.Required('code'): str, probatio.Required('revision'): int, probatio.Required('rule'): dict},
    DELETE: {probatio.Required('type'): DELETE, probatio.Required('code'): str, probatio.Required('revision'): int},
    ACTIVATE: {probatio.Required('type'): ACTIVATE, probatio.Required('code'): str, probatio.Required('revision'): int},
    DEACTIVATE: {probatio.Required('type'): DEACTIVATE, probatio.Required('code'): str, probatio.Required('revision'): int},
    PERMISSIONS: {probatio.Required('type'): PERMISSIONS},
    APPROVE: {probatio.Required('type'): APPROVE, probatio.Required('policy'): dict, probatio.Required('confirmed'): bool}}



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
        if msg['type']==DAILY:
            await bridge.handle(STATUS,{},authorized=authorized)
            from ..homolog_mirror.source132 import daily
            result=await daily(hass)
        else:
            result = await bridge.handle(msg['type'], {k: v for k, v in msg.items() if k not in ('id', 'type')},
                                     authorized=authorized)
        bridge.check(authorized)
        connection.send_result(msg['id'], result)
    except asyncio.CancelledError:
        raise
    except Exception:
        connection.send_error(msg['id'], 'automation_denied_or_unavailable',
                              'Automações indisponíveis ou acesso não autorizado.')


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
