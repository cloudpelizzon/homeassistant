"""Free Core Fleet enrollment; no automatic module activation or key approval."""
from datetime import datetime, timezone
from pathlib import Path
import re
import secrets
from uuid import uuid4

from homeassistant.const import __version__ as HA_VERSION
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.storage import Store
from homeassistant.loader import async_get_integration

from .owner_profile155 import owner_display_name
from .provision import provision
from .public_onboarding.protocol import FLEET_URL, fleet_ack

LOCK = 'cloudpelizzon_setup81_lock'


async def enroll_free(hass, user_input):
    import asyncio
    if type(user_input) is not dict or user_input.get('consent') is not True:
        raise PermissionError('consent_required')
    lock = hass.data.setdefault(LOCK, asyncio.Lock())
    async with lock:
        # Unified setup consent explicitly includes the required owner display name.
        owner_name = await owner_display_name(hass)
        store = Store(hass, 1, 'cloudpelizzon_core.data', private=True, atomic_writes=True)
        loaded = await store.async_load()
        if loaded is not None and type(loaded) is not dict:
            raise ValueError('existing_core_store_invalid')
        data = dict(loaded or {})
        iid = data.get('installation_id')
        if iid is not None and (type(iid) is not str or not re.fullmatch('[0-9a-f]{32}', iid)):
            raise ValueError('existing_core_identity_invalid')
        if iid is None:
            iid = data['installation_id'] = uuid4().hex
            data['created_at'] = datetime.now(timezone.utc).isoformat()
        secret = data.get('fleet_free_secret')
        if secret is not None and (type(secret) is not str or not re.fullmatch('[0-9a-f]{64}', secret)):
            raise ValueError('existing_fleet_identity_invalid')
        if secret is None:
            secret = data['fleet_free_secret'] = secrets.token_hex(32)
        # Persist continuity before any request. Keep unrelated legacy data.
        await store.async_save(data)
        await hass.async_add_executor_job(provision, Path(hass.config.path()))
        integration = await async_get_integration(hass, 'cloudpelizzon')
        version = str(integration.version or '')
        if not version or len(version) > 64:
            raise ValueError('integration_version_required')
        payload = {'mode': 'free', 'installation_id': iid, 'registration_secret': secret,
                   'fleet_reporting_consent': True, 'cloudpelizzon_version': version,
                   'ha_version': HA_VERSION}
        payload['ha_admin_name'] = owner_name
        session = async_get_clientsession(hass)
        async with asyncio.timeout(12):
            async with session.post(FLEET_URL, json=payload, allow_redirects=False) as response:
                raw = await response.content.read(8193)
                if response.status == 429 or response.status >= 500:
                    raise ConnectionError('fleet_temporarily_unavailable')
                fleet_ack(response.status, response.headers.get('Content-Type', ''), raw, iid)
        return {'fleet_registered': True, 'fleet_installation_id': iid,
                'fleet_reporting_consent': True, 'fleet_registration_mode': 'free',
                'fleet_owner_name_consent': True,
                'fleet_enrollment_schema': 4}
