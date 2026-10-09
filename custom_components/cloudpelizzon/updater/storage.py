"""Persistent state for CloudPelizzon Updater."""
from __future__ import annotations
from copy import deepcopy
from datetime import datetime, timezone
from homeassistant.helpers.storage import Store
from .const import STORAGE_KEY, STORAGE_VERSION

def _now():
    return datetime.now(timezone.utc).isoformat()

def default_data():
    return {
        "created_at": _now(),
        "release_key_fingerprint": "",
        "release_public_n": "",
        "release_public_e": 0,
        "last_check_at": "",
        "last_check_error": "",
        "channel": "",
        "releases": [],
        "documentation": [],
        "backups": [],
        "history": [],
        "pending_healthcheck": {},
        "restart_required": False,
    }

class UpdaterStore:
    def __init__(self, hass):
        self._store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self.data = default_data()
    async def async_load(self):
        loaded = await self._store.async_load()
        base = default_data()
        if isinstance(loaded, dict):
            base.update(deepcopy(loaded))
        for key in ("releases", "documentation", "backups", "history"):
            if not isinstance(base.get(key), list): base[key] = []
        if not isinstance(base.get("pending_healthcheck"), dict): base["pending_healthcheck"] = {}
        self.data = base
        return base
    async def async_save(self):
        await self._store.async_save(self.data)
