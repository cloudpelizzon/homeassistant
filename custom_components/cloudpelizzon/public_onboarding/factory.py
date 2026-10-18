"""Bind existing entry persistence and HA TLS transport; no automatic enrollment."""
from functools import partial
from pathlib import Path
from homeassistant.const import __version__ as HA_VERSION
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.loader import async_get_integration
from .bridge import Bridge
from .protocol import post_fleet
from .key import sign_existing
from ..enrollment106 import ensure
import asyncio
import logging


async def create(hass, entry, context):
    integration = await async_get_integration(hass, 'cloudpelizzon')
    version = integration.version

    def current():
        found = hass.config_entries.async_get_entry(entry.entry_id)
        if found is not entry or found.domain != 'cloudpelizzon':
            raise PermissionError('entry_removed_or_replaced')
        return found.data

    def persist(data):
        current()
        hass.config_entries.async_update_entry(entry, data=data)

    async def post(payload):
        # No request until an active administrator explicitly consents.
        return await post_fleet(async_get_clientsession(hass), payload)

    async def enroll():
        return await ensure(hass,entry,context)
    try:
        await enroll()
    except asyncio.CancelledError:
        raise
    except Exception:
        logging.getLogger(__name__).warning('Automatic enrollment unavailable; portal handoff can retry')
    folder = Path(hass.config.path('.cp-trial-phase2-enrollment')).absolute()
    return Bridge(core_id=context['core_id'], trial_id=context['trial_id'],
                  entry_data=current, persist=persist, post=post,
                  portal_signer=partial(sign_existing, folder),
                  executor=hass.async_add_executor_job,
                  version=version, ha_version=HA_VERSION,portal_enrollment=enroll)
