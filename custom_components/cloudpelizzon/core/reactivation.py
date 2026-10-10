"""Resume commercial runtimes after a verified online license reactivation.

When a SKU was denied at HA bootstrap, its runtime was intentionally not
registered. Updating CP1/CP2 status alone cannot start it. Reload only the
CloudPelizzon config entry (never Home Assistant) after a successful
authenticated active response. All installed SKUs are handled uniformly.
"""

from __future__ import annotations

import asyncio
import logging
import time
from pathlib import Path

_LOGGER = logging.getLogger(__name__)

MODULES = {
    "maintenance": "CP-MAINTENANCE",
    "energy": "CP-ENERGY",
    "security": "CP-SECURITY",
}
RELOAD_COOLDOWN_SEC = 300
MODULES_ROOT = Path(__file__).resolve().parents[1] / "modules"


def _needs_runtime_resume(hass) -> bool:
    """An installed, entitled module skipped at startup needs its runtime."""
    platform = hass.data.get("cloudpelizzon")
    if not isinstance(platform, dict):
        return False
    if platform.get("runtime_state") != "running":
        return False
    if not platform.get("entry_id"):
        return False

    core = platform.get("core")
    if not isinstance(core, dict):
        return False
    manager = core.get("license_manager")
    control = core.get("control")
    if manager is None or control is None or getattr(control, "mode", None) != "enforce":
        return False
    if str(manager.data.get("online_status") or "") != "active":
        return False

    denied = platform.get("optional_modules", {})
    if not isinstance(denied, dict):
        return False

    root = MODULES_ROOT
    for name, sku in MODULES.items():
        status = str(denied.get(name) or "")
        if not status.startswith("license_denied:"):
            continue
        if name in platform:
            # Security might already run a safety-only runtime. Its internal
            # guards become active on successful reactivation without reload.
            continue
        if not (root / name).is_dir():
            continue
        try:
            if manager.status_sync(sku, installed=True).get("allowed") is True:
                return True
        except Exception:
            _LOGGER.exception("CloudPelizzon reactivation entitlement error: %s", sku)
    return False


async def _reload_entry_after_reactivation(hass, entry_id: str) -> None:
    # Allow the triggering WebSocket response to complete before unloading.
    await asyncio.sleep(2)
    platform = hass.data.get("cloudpelizzon")
    if not isinstance(platform, dict) or platform.get("entry_id") != entry_id:
        return
    if not _needs_runtime_resume(hass):
        return
    try:
        result = await hass.config_entries.async_reload(entry_id)
        if result is False:
            _LOGGER.error("CloudPelizzon reactivation config-entry reload returned false")
    except asyncio.CancelledError:
        raise
    except Exception:
        _LOGGER.exception("CloudPelizzon reactivation config-entry reload failed")


def schedule_reactivation_resume(hass) -> bool:
    """Schedule at most one entry reload, only after fresh active entitlement.

    Non-blocking: safe to call while LicenseManager's check-in lock is held.
    No forced restart and no writes to commercial module storage.
    """
    if not _needs_runtime_resume(hass):
        return False

    platform = hass.data["cloudpelizzon"]
    task = platform.get("reactivation_reload_task")
    if task is not None and not task.done():
        return False

    now = time.monotonic()
    last = float(platform.get("reactivation_reload_last", 0))
    if last and now - last < RELOAD_COOLDOWN_SEC:
        return False

    entry_id = platform["entry_id"]
    platform["reactivation_reload_last"] = now
    platform["reactivation_reload_task"] = hass.async_create_background_task(
        _reload_entry_after_reactivation(hass, entry_id),
        "cloudpelizzon-reactivation-runtime-resume",
    )
    _LOGGER.info(
        "CloudPelizzon licensed module reactivated: scheduling integration reload"
    )
    return True
