"""Operator-only WebSocket API for CloudPelizzon."""

from __future__ import annotations

import probatio

from homeassistant.components import websocket_api
from homeassistant.core import callback

from .const import (
    DOMAIN,
    VERSION as PLATFORM_VERSION,
)
from .core.const import (
    VERSION as CORE_VERSION,
)
from .operator import (
    is_operator_mode,
)
from .updater.const import (
    VERSION as UPDATER_VERSION,
)


_REGISTERED_KEY = (
    "_cloudpelizzon_operator_api_registered"
)


def _platform(hass):

    data = hass.data.get(DOMAIN)

    return (
        data
        if isinstance(data, dict)
        else {}
    )


@websocket_api.require_admin
@websocket_api.websocket_command({
    probatio.Required("type"):
        "cloudpelizzon/operator/status"
})
@websocket_api.async_response
async def ws_operator_status(
    hass,
    connection,
    msg,
):

    connection.send_result(
        msg["id"],
        {
            "allowed":
                is_operator_mode(hass)
        },
    )


@websocket_api.require_admin
@websocket_api.websocket_command({
    probatio.Required("type"):
        "cloudpelizzon/operator/licensing"
})
@websocket_api.async_response
async def ws_operator_licensing(
    hass,
    connection,
    msg,
):

    if not is_operator_mode(hass):

        connection.send_error(
            msg["id"],
            "forbidden",
            "Operator access required",
        )

        return

    platform = _platform(hass)

    core = platform.get("core")

    if not isinstance(core, dict):

        connection.send_error(
            msg["id"],
            "core_not_loaded",
            "CloudPelizzon Core not loaded",
        )

        return

    manager = core.get(
        "license_manager"
    )

    data = core.get(
        "data"
    )

    if (
        manager is None
        or not isinstance(data, dict)
    ):

        connection.send_error(
            msg["id"],
            "license_manager_unavailable",
            "License manager unavailable",
        )

        return

    payload = (
        manager.current_payload()
        or {}
    )

    catalog = await manager.async_catalog(
        hass
    )

    updater_info = {
        "version": UPDATER_VERSION,
        "channel": "—",
        "last_check_at": None,
        "last_check_error": None,
        "release_key_fingerprint": None,
        "components": [],
        "backups": [],
    }

    updater = platform.get(
        "updater"
    )

    if isinstance(updater, dict):

        updater_manager = updater.get(
            "manager"
        )

        if updater_manager:

            try:

                status = (
                    updater_manager.status()
                )

                updater_info.update({
                    "version":
                        status.get(
                            "version"
                        ),
                    "channel":
                        status.get(
                            "channel"
                        ),
                    "last_check_at":
                        status.get(
                            "last_check_at"
                        ),
                    "last_check_error":
                        status.get(
                            "last_check_error"
                        ),
                    "release_key_fingerprint":
                        status.get(
                            "release_key_fingerprint"
                        ),
                    "components":
                        status.get(
                            "components"
                        )
                        or [],
                    "backups":
                        status.get(
                            "backups"
                        )
                        or [],
                })

            except Exception:
                pass

    lease = data.get(
        "lease_payload"
    )

    if not isinstance(
        lease,
        dict,
    ):
        lease = {}

    connection.send_result(
        msg["id"],
        {
            "operator": True,

            "platform_version":
                PLATFORM_VERSION,

            "core_version":
                CORE_VERSION,

            "license": {
                "present":
                    bool(
                        data.get(
                            "license_token"
                        )
                    ),

                "license_id":
                    payload.get(
                        "license_id"
                    ),

                "customer":
                    payload.get(
                        "customer"
                    ),

                "expires_at":
                    payload.get(
                        "expires_at"
                    ),

                "activation_id":
                    data.get(
                        "activation_id"
                    ),

                "online_status":
                    data.get(
                        "online_status"
                    )
                    or "not_activated",

                "last_checkin_at":
                    data.get(
                        "last_checkin_at"
                    ),

                "last_checkin_error":
                    data.get(
                        "last_checkin_error"
                    ),

                "lease_valid_until":
                    lease.get(
                        "valid_until"
                    ),

                "license_revision":
                    data.get(
                        "license_revision"
                    )
                    or 0,

                "server_url":
                    data.get(
                        "license_server_url"
                    )
                    or "",
            },

            "modules":
                catalog,

            "updater":
                updater_info,

            "load_errors":
                platform.get(
                    "load_errors"
                )
                or {},
        },
    )


@callback
def async_register_operator_api(
    hass,
) -> None:

    if hass.data.get(
        _REGISTERED_KEY
    ):
        return

    websocket_api.async_register_command(
        hass,
        ws_operator_status,
    )

    websocket_api.async_register_command(
        hass,
        ws_operator_licensing,
    )

    hass.data[
        _REGISTERED_KEY
    ] = True
