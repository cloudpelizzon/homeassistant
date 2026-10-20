"""Explicit commercial contact transport, independent of module entitlements."""
import asyncio
import json
import re
from urllib.parse import urlsplit

import probatio
from homeassistant.components import websocket_api
from homeassistant.const import __version__ as HA_VERSION
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.storage import Store
from homeassistant.loader import async_get_integration

from .public_core.metadata import MODULES

COMMAND = 'cloudpelizzon/core/commercial/request'
KEY = 'cloudpelizzon_commercial157'
URL = 'https://api.cloudpelizzon.com.br/v1/commercial/request'
LIMITS = {'name': 160, 'phone': 80, 'email': 250, 'subject': 250, 'message': 4000}


def fields(msg):
    if set(msg) != {'id', 'type', 'sku', *LIMITS} or msg['type'] != COMMAND or msg['sku'] not in MODULES:
        raise ValueError('invalid_fields')
    result = {'sku': msg['sku']}
    for key, limit in LIMITS.items():
        value = msg[key]
        if type(value) is not str or not value.strip() or len(value) > limit or '\x00' in value:
            raise ValueError('invalid_fields')
        result[key] = value.strip()
    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', result['email']):
        raise ValueError('invalid_email')
    return result


def receipt(status, content_type, raw, sku):
    if status not in (200, 201) or len(raw) > 8192 or content_type.split(';')[0].lower() != 'application/json':
        raise ValueError('unconfirmed_request')
    value = json.loads(raw)
    if (type(value) is not dict or value.get('ok') is not True or value.get('status') != 'registered'
            or value.get('sku') != sku or type(value.get('request_id')) is not str
            or not re.fullmatch(r'REQ-[A-F0-9]{12}', value['request_id'])):
        raise ValueError('invalid_receipt')
    safe = {key: value[key] for key in ('ok', 'status', 'sku', 'request_id')}
    for key, allowed in {
        'email_status': {'sent', 'failed', 'pending', 'not_configured'},
        'dolibarr_status': {'linked_existing', 'prospect_created', 'forwarded_to_n8n', 'not_linked', 'write_not_configured'},
        'n8n_status': {'sent', 'not_configured'},
    }.items():
        safe[key] = value.get(key) if value.get(key) in allowed else 'pending'
    url = value.get('whatsapp_url', '')
    if type(url) is str and len(url) <= 24000:
        parsed = urlsplit(url)
        if (parsed.scheme == 'https' and parsed.netloc == 'wa.me'
                and re.fullmatch(r'/[0-9]{8,16}', parsed.path) and not parsed.fragment
                and not any(ord(char) < 32 for char in url)):
            safe['whatsapp_url'] = url
    return safe


async def dispatch(hass, connection, msg):
    state = hass.data.get(KEY)
    user = connection.user
    async def authorized():
        if (state is None or state['closed'] or hass.data.get(KEY) is not state
                or user is None or connection.user is not user or not user.is_active):
            return False
        current = await hass.auth.async_get_user(user.id)
        return current is not None and current.is_active and not state['closed'] and hass.data.get(KEY) is state
    acquired = False
    try:
        if not await authorized():
            connection.send_error(msg['id'], 'unauthorized', 'Sessão ativa necessária para enviar a solicitação.')
            return
        payload = fields(msg)
        if state['busy']:
            connection.send_error(msg['id'], 'commercial_busy', 'Já existe uma solicitação em envio. Aguarde a confirmação.')
            return
        state['busy'] = True
        acquired = True
        saved = await Store(hass, 1, 'cloudpelizzon_core.data', private=True, atomic_writes=True).async_load()
        secret = saved.get('fleet_free_secret') if isinstance(saved, dict) else None
        if (not isinstance(saved, dict) or saved.get('installation_id') != state['core_id']
                or type(secret) is not str or not re.fullmatch('[a-f0-9]{64}', secret)):
            raise ValueError('existing_registration_required')
        integration = await async_get_integration(hass, 'cloudpelizzon')
        payload.update(installation_id=state['core_id'], registration_secret=secret,
                       core_version=str(integration.version or ''), ha_version=HA_VERSION)
        if not await authorized():
            raise PermissionError('session_changed')
        # No automatic retry: a lost response may follow an already saved contact.
        async with asyncio.timeout(100):
            async with async_get_clientsession(hass).post(URL, json=payload, allow_redirects=False) as response:
                raw = await response.content.read(8193)
                result = receipt(response.status, response.headers.get('Content-Type', ''), raw, payload['sku'])
        if not await authorized():
            raise PermissionError('session_changed')
        connection.send_result(msg['id'], result)
    except asyncio.CancelledError:
        raise
    except Exception:
        # Never expose contact data, registration credentials or upstream internals.
        connection.send_error(msg['id'], 'commercial_request_unconfirmed',
            'Não foi possível confirmar o registro. Consulte suas solicitações no Portal antes de reenviar.')
    finally:
        if acquired:
            state['busy'] = False


def register(hass, core_id):
    registry = hass.data.get(websocket_api.DOMAIN, {})
    if not re.fullmatch('[a-f0-9]{32}', core_id) or KEY in hass.data or COMMAND in registry:
        raise ValueError('commercial_command_conflict')
    state = {'core_id': core_id, 'closed': False, 'busy': False}
    schema = {probatio.Required('type'): COMMAND, probatio.Required('sku'): str,
              **{probatio.Required(key): str for key in LIMITS}}
    handler = websocket_api.websocket_command(schema)(websocket_api.async_response(dispatch))
    hass.data[KEY] = state
    def close():
        state['closed'] = True
        if hass.data.get(KEY) is state:
            hass.data.pop(KEY)
        current = hass.data.get(websocket_api.DOMAIN, {})
        if COMMAND in current and current[COMMAND][0] is handler:
            current.pop(COMMAND)
    try:
        websocket_api.async_register_command(hass, handler)
    except BaseException:
        close()
        raise
    return close
