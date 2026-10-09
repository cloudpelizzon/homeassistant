"""WebSocket API for CloudPelizzon Core."""
from __future__ import annotations
import probatio
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from .const import DOMAIN, VERSION


def _runtime(hass: HomeAssistant):
    data = hass.data.get(DOMAIN)
    return data if isinstance(data, dict) and "license_manager" in data else None


@websocket_api.websocket_command({probatio.Required("type"): "cloudpelizzon/core/status"})
@websocket_api.async_response
async def ws_status(hass, connection, msg):
    runtime = _runtime(hass)
    if runtime is None:
        connection.send_error(msg["id"], "not_loaded", "CloudPelizzon Core not loaded")
        return
    manager = runtime["license_manager"]
    catalog = await manager.async_catalog(hass)
    payload = manager.current_payload()
    d = runtime["data"]
    connection.send_result(msg["id"], {
        "core_version": VERSION,
        "installation_id": manager.installation_id,
        "created_at": d.get("created_at"),
        "license": {
            "present": bool(d.get("license_token")),
            "license_id": payload.get("license_id") if payload else None,
            "customer": payload.get("customer") if payload else None,
            "expires_at": payload.get("expires_at") if payload else None,
            "modules": payload.get("modules") if payload else [],
            "activation_id": d.get("activation_id") or None,
            "online_status": d.get("online_status") or "not_activated",
            "last_checkin_at": d.get("last_checkin_at") or None,
            "last_checkin_error": d.get("last_checkin_error") or None,
            "lease_valid_until": (d.get("lease_payload") or {}).get("valid_until"),
            "license_revision": d.get("license_revision") or 0,
            "server_url": d.get("license_server_url") or "",
        },
        "modules": catalog,
    })


@websocket_api.websocket_command({
    probatio.Required("type"): "cloudpelizzon/core/license/status",
    probatio.Required("sku"): str,
})
@websocket_api.async_response
async def ws_license_status(hass, connection, msg):
    runtime = _runtime(hass)
    if runtime is None:
        connection.send_error(msg["id"], "not_loaded", "CloudPelizzon Core not loaded")
        return
    sku = msg["sku"]
    manager = runtime["license_manager"]
    meta = next((x for x in (await manager.async_catalog(hass)) if x["sku"] == sku), None)
    if meta is None:
        connection.send_error(msg["id"], "unknown_module", "Unknown CloudPelizzon module")
        return
    result = dict(meta["license"])
    result.update({"installation_id": runtime["license_manager"].installation_id, "module": meta["name"], "preview": meta["preview"], "path": meta.get("path")})
    connection.send_result(msg["id"], result)


@websocket_api.require_admin
@websocket_api.websocket_command({
    probatio.Required("type"): "cloudpelizzon/core/license/activate",
    probatio.Required("token"): str,
})
@websocket_api.async_response
async def ws_license_activate(hass, connection, msg):
    runtime = _runtime(hass)
    if runtime is None:
        connection.send_error(msg["id"], "not_loaded", "CloudPelizzon Core not loaded")
        return
    try:
        payload = await runtime["license_manager"].async_activate(msg["token"])
    except (ValueError, RuntimeError) as err:
        connection.send_error(msg["id"], "license_activation_failed", str(err))
        return
    connection.send_result(msg["id"], {"activated": True, "license": payload, "diagnostics": runtime["license_manager"].diagnostics()})


@websocket_api.require_admin
@websocket_api.websocket_command({probatio.Required("type"): "cloudpelizzon/core/license/checkin"})
@websocket_api.async_response
async def ws_license_checkin(hass, connection, msg):
    runtime = _runtime(hass)
    if runtime is None:
        connection.send_error(msg["id"], "not_loaded", "CloudPelizzon Core not loaded")
        return
    result = await runtime["license_manager"].async_checkin(force=True)
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command({
    probatio.Required("type"): "cloudpelizzon/core/access/refresh",
})
@websocket_api.async_response
async def ws_access_refresh(hass, connection, msg):
    """Authenticated, non-secret entitlement refresh for regular HA users."""
    runtime = _runtime(hass)
    if runtime is None:
        connection.send_error(msg["id"], "not_loaded", "CloudPelizzon Core not loaded")
        return
    manager = runtime["license_manager"]
    try:
        await manager.async_checkin(force=True)
        catalog = await manager.async_catalog(hass)
    except Exception:
        connection.send_error(msg["id"], "license_unavailable", "Cannot verify module license")
        return
    connection.send_result(msg["id"], {
        "online_status": manager.data.get("online_status") or "not_activated",
        "modules": [{
            "sku": item["sku"],
            "allowed": bool(item.get("license", {}).get("allowed")),
            "status": str(item.get("license", {}).get("status") or ""),
        } for item in catalog],
    })


@websocket_api.require_admin
@websocket_api.websocket_command({probatio.Required("type"): "cloudpelizzon/core/license/diagnostics"})
@websocket_api.async_response
async def ws_license_diagnostics(hass, connection, msg):
    runtime = _runtime(hass)
    if runtime is None:
        connection.send_error(msg["id"], "not_loaded", "CloudPelizzon Core not loaded")
        return
    result = runtime["license_manager"].diagnostics()
    result["installation_id"] = runtime["license_manager"].installation_id
    result["core_version"] = VERSION
    connection.send_result(msg["id"], result)


@websocket_api.require_admin
@websocket_api.websocket_command({
    probatio.Required("type"): "cloudpelizzon/core/license/server_url",
    probatio.Required("url"): str,
})
@websocket_api.async_response
async def ws_license_server_url(hass, connection, msg):
    runtime = _runtime(hass)
    if runtime is None:
        connection.send_error(msg["id"], "not_loaded", "CloudPelizzon Core not loaded")
        return
    try:
        await runtime["license_manager"].async_set_server_url(msg["url"])
    except ValueError as err:
        connection.send_error(msg["id"], str(err), str(err))
        return
    connection.send_result(msg["id"], {"saved": True, "server_url": runtime["license_manager"].server_url})


@websocket_api.websocket_command({
    probatio.Required("type"): "cloudpelizzon/core/commercial/request",
    probatio.Required("sku"): str,
    probatio.Required("name"): str,
    probatio.Required("phone"): str,
    probatio.Required("email"): str,
    probatio.Required("subject"): str,
    probatio.Required("message"): str,
})
@websocket_api.async_response
async def ws_commercial_request(hass, connection, msg):
    runtime = _runtime(hass)
    if runtime is None:
        connection.send_error(msg["id"], "not_loaded", "CloudPelizzon Core not loaded")
        return
    try:
        result = await runtime["license_manager"].async_commercial_request(msg)
    except (ValueError, RuntimeError) as err:
        connection.send_error(msg["id"], "commercial_request_failed", str(err))
        return
    connection.send_result(msg["id"], result)


@websocket_api.require_admin
@websocket_api.websocket_command({probatio.Required("type"): "cloudpelizzon/core/license/clear"})
@websocket_api.async_response
async def ws_license_clear(hass, connection, msg):
    runtime = _runtime(hass)
    if runtime is None:
        connection.send_error(msg["id"], "not_loaded", "CloudPelizzon Core not loaded")
        return
    await runtime["license_manager"].async_clear()
    connection.send_result(msg["id"], {"cleared": True})


@callback
def async_register_api(hass: HomeAssistant) -> None:
    for command in (
        ws_status,
        ws_license_status,
        ws_license_activate,
        ws_license_checkin,
        ws_access_refresh,
        ws_license_diagnostics,
        ws_license_server_url,
        ws_commercial_request,
        ws_license_clear,
    ):
        websocket_api.async_register_command(hass, command)
