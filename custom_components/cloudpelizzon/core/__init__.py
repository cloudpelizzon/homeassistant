"""CloudPelizzon Core."""
from __future__ import annotations
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.typing import ConfigType
from .api import async_register_api
from .const import DOMAIN
from .frontend import async_register_frontend, async_unregister_frontend
from .license import LicenseManager
from .storage import CoreStore

async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    async_register_api(hass)
    return True

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    store = CoreStore(hass)
    data = await store.async_load()
    license_manager = LicenseManager(hass, store)
    hass.data[DOMAIN] = {
        "entry_id": entry.entry_id,
        "store": store,
        "data": data,
        "license_manager": license_manager,
    }
    await store.async_save()
    license_manager.ensure_checkin_task()
    await async_register_frontend(hass)
    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    runtime = hass.data.get(DOMAIN)
    if isinstance(runtime, dict) and runtime.get("license_manager"):
        await runtime["license_manager"].async_stop()
    async_unregister_frontend(hass)
    hass.data.pop(DOMAIN, None)
    return True
