"""Persistent storage for CloudPelizzon Core."""
from __future__ import annotations
from copy import deepcopy
from datetime import datetime, timezone
from uuid import uuid4
from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store
from .const import (
    STORAGE_KEY,
    STORAGE_VERSION,
    VERSION,
    LICENSE_SERVER_URL_DEFAULT,
    DEFAULT_CHECKIN_INTERVAL_SEC,
    DEFAULT_OFFLINE_GRACE_SEC,
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def default_data() -> dict:
    return {
        "installation_id": uuid4().hex,
        "created_at": _now(),
        "core_version": VERSION,
        "license_token": "",
        "license_payload": {},
        "license_activated_at": "",
        "license_server_url": LICENSE_SERVER_URL_DEFAULT,
        "activation_id": "",
        "activation_secret": "",
        "lease_token": "",
        "lease_payload": {},
        "license_revision": 0,
        "online_status": "not_activated",
        "last_checkin_at": "",
        "last_checkin_error": "",
        "checkin_interval_sec": DEFAULT_CHECKIN_INTERVAL_SEC,
        "offline_grace_sec": DEFAULT_OFFLINE_GRACE_SEC,
        # kept only so upgrades from R4 do not lose historical data; R5 does
        # not use automatic module trials for entitlement.
        "module_trials": {},
    }


class CoreStore:
    def __init__(self, hass: HomeAssistant) -> None:
        self._store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self.data = default_data()

    async def async_load(self) -> dict:
        loaded = await self._store.async_load()
        base = default_data()
        if isinstance(loaded, dict):
            base.update(deepcopy(loaded))
        if not base.get("installation_id"):
            base["installation_id"] = uuid4().hex
        if not base.get("created_at"):
            base["created_at"] = _now()
        if not isinstance(base.get("module_trials"), dict):
            base["module_trials"] = {}
        if not isinstance(base.get("lease_payload"), dict):
            base["lease_payload"] = {}
        if not isinstance(base.get("license_payload"), dict):
            base["license_payload"] = {}
        if not base.get("license_server_url"):
            base["license_server_url"] = LICENSE_SERVER_URL_DEFAULT
        base["core_version"] = VERSION
        self.data = base
        return self.data

    async def async_save(self) -> None:
        await self._store.async_save(self.data)
