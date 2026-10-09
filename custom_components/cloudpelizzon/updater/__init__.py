"""CloudPelizzon Updater - independent recovery/update plane."""
from __future__ import annotations
from .api import async_register_api
from .const import DOMAIN
from .frontend import async_register_frontend
from .manager import UpdateManager
from .storage import UpdaterStore
async def async_setup(hass,config):
    if DOMAIN in hass.data: return True
    store=UpdaterStore(hass); await store.async_load(); manager=UpdateManager(hass,store)
    hass.data[DOMAIN]={"store":store,"manager":manager}
    async_register_api(hass); await async_register_frontend(hass); manager.schedule_pending_healthcheck(); return True
