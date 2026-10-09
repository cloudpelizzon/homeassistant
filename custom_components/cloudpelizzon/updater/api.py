"""WebSocket API for the unified CloudPelizzon Release Center."""

from __future__ import annotations
import logging

import probatio

from homeassistant.components import websocket_api
from homeassistant.core import callback

from ..const import DOMAIN as PLATFORM_DOMAIN


_LOGGER = logging.getLogger(__name__)

_REGISTERED_KEY = (
    "_cloudpelizzon_updater_api_registered"
)


def _manager(hass):

    platform = hass.data.get(
        PLATFORM_DOMAIN
    )

    if not isinstance(
        platform,
        dict,
    ):
        return None

    updater = platform.get(
        "updater"
    )

    if not isinstance(
        updater,
        dict,
    ):
        return None

    return updater.get(
        "manager"
    )


def _need(
    hass,
    connection,
    msg,
):

    manager = _manager(hass)

    if manager is None:

        connection.send_error(
            msg["id"],
            "not_loaded",
            "Central de Atualizações CloudPelizzon indisponível.",
        )

    return manager


@websocket_api.require_admin
@websocket_api.websocket_command({
    probatio.Required("type"):
        "cloudpelizzon/updater/status"
})
@websocket_api.async_response
async def status(
    hass,
    connection,
    msg,
):

    manager = _need(
        hass,
        connection,
        msg,
    )

    if manager:

        connection.send_result(
            msg["id"],
            manager.status(),
        )


@websocket_api.require_admin
@websocket_api.websocket_command({
    probatio.Required("type"):
        "cloudpelizzon/updater/check"
})
@websocket_api.async_response
async def check(
    hass,
    connection,
    msg,
):

    manager = _need(
        hass,
        connection,
        msg,
    )

    if not manager:
        return

    try:

        result = (
            await manager.async_check()
        )

        connection.send_result(
            msg["id"],
            result,
        )

    except Exception as error:

        connection.send_error(
            msg["id"],
            "update_check_failed",
            str(error),
        )


@websocket_api.require_admin
@websocket_api.websocket_command({
    probatio.Required("type"):
        "cloudpelizzon/updater/install",

    probatio.Required("release_id"):
        str,
})
@websocket_api.async_response
async def install(
    hass,
    connection,
    msg,
):

    manager = _need(
        hass,
        connection,
        msg,
    )

    if not manager:
        return

    try:

        result = (
            await manager.async_install(
                msg["release_id"]
            )
        )

        connection.send_result(
            msg["id"],
            result,
        )

    except Exception as error:

        connection.send_error(
            msg["id"],
            "update_install_failed",
            str(error),
        )


@websocket_api.require_admin
@websocket_api.websocket_command({
    probatio.Required("type"):
        "cloudpelizzon/updater/rollback",

    probatio.Required("backup_id"):
        str,
})
@websocket_api.async_response
async def rollback(
    hass,
    connection,
    msg,
):

    manager = _need(
        hass,
        connection,
        msg,
    )

    if not manager:
        return

    try:

        result = (
            await manager.async_rollback(
                msg["backup_id"]
            )
        )

        connection.send_result(
            msg["id"],
            result,
        )

    except Exception as error:

        connection.send_error(
            msg["id"],
            "rollback_failed",
            str(error),
        )


@websocket_api.require_admin
@websocket_api.websocket_command({
    probatio.Required("type"):
        "cloudpelizzon/updater/restart"
})
@websocket_api.async_response
async def restart(
    hass,
    connection,
    msg,
):

    manager = _need(
        hass,
        connection,
        msg,
    )

    if manager:

        connection.send_result(
            msg["id"],
            await manager.async_restart(),
        )


#
# DOCUMENTAÇÃO
#
# Não retorna backup, caminhos locais,
# fingerprint, Activation ID ou segredos.
#
@websocket_api.websocket_command({
    probatio.Required("type"):
        "cloudpelizzon/docs/list"
})
@websocket_api.async_response
async def documentation(
    hass,
    connection,
    msg,
):

    manager = _manager(hass)

    if manager is None:

        connection.send_result(
            msg["id"],
            {
                "documentation": [],
                "available": False,
            },
        )

        return

    docs = (
        manager.data.get(
            "documentation",
            []
        )
        or []
    )

    safe_docs = []

    for item in docs:

        if not isinstance(
            item,
            dict,
        ):
            continue

        safe_docs.append({
            "sku":
                item.get("sku"),

            "title":
                item.get("title"),

            "doc_type":
                item.get("doc_type"),

            "version":
                item.get("version"),

            "published_at":
                item.get(
                    "published_at"
                ),

            "content_md":
                item.get(
                    "content_md"
                )
                or "",
        })

    connection.send_result(
        msg["id"],
        {
            "documentation":
                safe_docs,

            "available":
                True,
        },
    )



@callback
def async_register_api(
    hass,
) -> None:

    commands = (
        status,
        check,
        install,
        rollback,
        restart,
        documentation,
    )

    #
    # Registro propositalmente idempotente:
    # async_register_command grava/atualiza
    # o handler pela chave do comando.
    #
    for command in commands:

        websocket_api.async_register_command(
            hass,
            command,
        )

    handlers = hass.data.get(
        websocket_api.DOMAIN,
        {},
    )

    expected = [
        getattr(
            command,
            "_ws_command",
            "UNKNOWN",
        )
        for command in commands
    ]

    present = [
        name
        for name in expected
        if name in handlers
    ]

    missing = [
        name
        for name in expected
        if name not in handlers
    ]

    _LOGGER.warning(
        "CLOUDPELIZZON_WS_DIAG expected=%s present=%s missing=%s total_handlers=%s",
        expected,
        present,
        missing,
        len(handlers),
    )

    hass.data[
        _REGISTERED_KEY
    ] = True
