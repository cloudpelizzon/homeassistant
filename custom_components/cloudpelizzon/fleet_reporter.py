"""Refresh consented Fleet metadata without registering a new identity or trial."""
import asyncio
from datetime import timedelta
import logging
import re

from homeassistant.const import __version__ as HA_VERSION
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.storage import Store
from homeassistant.loader import async_get_integration

from .public_onboarding.protocol import FLEET_URL, fleet_ack

_LOGGER = logging.getLogger(__name__)


def start(hass, entry):
    """Return an unload callback; never delay integration setup on Fleet."""
    data = entry.data
    if (data.get('fleet_reporting_consent') is not True
            or data.get('fleet_registered') is not True
            or data.get('fleet_registration_mode') != 'free'):
        return lambda: None
    pending = None
    closed = False

    async def report():
        try:
            saved = await Store(hass, 1, 'cloudpelizzon_core.data',
                                private=True, atomic_writes=True).async_load()
            if not isinstance(saved, dict):
                return
            iid, secret = saved.get('installation_id'), saved.get('fleet_free_secret')
            if (type(iid) is not str or not re.fullmatch('[0-9a-f]{32}', iid)
                    or iid != data.get('fleet_installation_id')
                    or type(secret) is not str or not re.fullmatch('[0-9a-f]{64}', secret)):
                return
            integration = await async_get_integration(hass, 'cloudpelizzon')
            payload = {'mode': 'free', 'installation_id': iid, 'registration_secret': secret,
                       'fleet_reporting_consent': True,
                       'cloudpelizzon_version': str(integration.version or ''),
                       'ha_version': HA_VERSION}
            session = async_get_clientsession(hass)
            async with asyncio.timeout(12):
                async with session.post(FLEET_URL, json=payload, allow_redirects=False) as response:
                    raw = await response.content.read(8193)
                    fleet_ack(response.status, response.headers.get('Content-Type', ''), raw, iid)
        except asyncio.CancelledError:
            raise
        except Exception:
            # Do not log responses, identifiers, local storage or shared secrets.
            _LOGGER.debug('Fleet metadata refresh unavailable; will retry on the next interval')

    def schedule(_now=None):
        nonlocal pending
        if not closed and (pending is None or pending.done()):
            pending = hass.async_create_task(report(), 'CloudPelizzon Fleet metadata')

    unsubscribe = async_track_time_interval(hass, schedule, timedelta(hours=6))
    schedule()

    def close():
        nonlocal closed
        closed = True
        unsubscribe()
        if pending is not None:
            pending.cancel()

    return close
