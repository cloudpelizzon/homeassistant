"""Fail-closed WebSocket enforcement for privately installed commercial modules.

The guard is installed centrally when each commercial runtime registers its WS
handlers. It cannot be bypassed by hiding/showing a frontend tab. HTTP routes,
services and background work require their own guards in commercial packages.
"""

from __future__ import annotations

import inspect
import logging

from homeassistant.components import websocket_api

LOGGER = logging.getLogger(__name__)
PLATFORM_DOMAIN = "cloudpelizzon"
WS_DOMAIN = "websocket_api"


def registered_commands(hass) -> set[str]:
    handlers = hass.data.get(WS_DOMAIN)
    if not isinstance(handlers, dict):
        raise RuntimeError("commercial_ws_registry_unavailable")
    return set(handlers)


def protect_new_commands(hass, before: set[str], sku: str) -> list[str]:
    """Wrap only commands registered by the commercial module's startup."""
    handlers = hass.data.get(WS_DOMAIN)
    if not isinstance(handlers, dict):
        raise RuntimeError("commercial_ws_registry_unavailable")

    added = sorted(set(handlers) - set(before))
    protected = []

    for command in added:
        entry = handlers.get(command)
        if not isinstance(entry, tuple) or len(entry) != 2:
            raise RuntimeError("commercial_ws_registration_invalid")

        original, schema = entry
        if getattr(original, "_cp_commercial_guard", False):
            continue

        def make_guard(handler, module_sku):
            @websocket_api.async_response
            async def guarded(hass, connection, msg):
                platform = hass.data.get(PLATFORM_DOMAIN, {})
                core = platform.get("core", {}) if isinstance(platform, dict) else {}
                manager = core.get("license_manager") if isinstance(core, dict) else None
                if manager is None:
                    connection.send_error(
                        msg["id"], "commercial_license_denied",
                        "CloudPelizzon license authority unavailable",
                    )
                    return

                # Rate-limited online check-in. Immediate revocation is detected
                # on the next successful online verification, not while offline.
                try:
                    await manager.async_checkin()
                except Exception:
                    LOGGER.exception("Commercial entitlement refresh failed")

                entitlement = manager.status_sync(module_sku, installed=True)
                if not entitlement.get("allowed", False):
                    connection.send_error(
                        msg["id"], "commercial_license_denied",
                        "Module license is inactive, revoked or not entitled",
                    )
                    return

                result = handler(hass, connection, msg)
                if inspect.isawaitable(result):
                    await result

            guarded._cp_commercial_guard = True
            guarded._cp_commercial_sku = module_sku
            return guarded

        handlers[command] = (make_guard(original, sku), schema)
        protected.append(command)

    LOGGER.info(
        "CloudPelizzon commercial WebSocket guard: sku=%s commands=%s",
        sku, len(protected),
    )
    return protected
