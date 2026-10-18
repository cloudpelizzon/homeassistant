"""Public CloudPelizzon client candidate for preprovisioned installations."""
from homeassistant.exceptions import ConfigEntryNotReady
from .runtime import DOMAIN, OWNER, Runtime
from homeassistant.helpers import config_validation as cv

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


async def async_setup(hass, config):
    return True


async def async_setup_entry(hass, entry):
    try:
        await Runtime(hass, entry).start()
    except Exception:
        raise ConfigEntryNotReady('CloudPelizzon client initialization unavailable') from None
    return True


async def async_unload_entry(hass, entry):
    state = hass.data.get(DOMAIN)
    manager = state.get(OWNER) if isinstance(state, dict) else None
    if not isinstance(manager, Runtime) or manager.entry.entry_id != entry.entry_id:
        return False
    return await manager.unload()
