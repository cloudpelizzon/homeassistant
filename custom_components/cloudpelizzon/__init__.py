"""CloudPelizzon stable bootstrap.

The Home Assistant config entry must never fail because an optional
CloudPelizzon subsystem failed to initialize.
"""

from __future__ import annotations

import logging


DOMAIN = "cloudpelizzon"

_LOGGER = logging.getLogger(__name__)


async def async_setup(hass, config) -> bool:
    """Prepare the unified CloudPelizzon namespace."""

    hass.data.setdefault(
        DOMAIN,
        {},
    )

    return True


async def async_setup_entry(hass, entry) -> bool:
    """Load CloudPelizzon immediately and start optional workers."""

    platform = hass.data.setdefault(
        DOMAIN,
        {},
    )

    platform["entry_id"] = entry.entry_id
    platform["loaded"] = True
    platform["load_errors"] = {}
    platform["runtime_state"] = "starting"

    #
    # --------------------------------------------------------
    # EXISTING CLOUDPELIZZON RUNTIME
    # --------------------------------------------------------
    #
    async def _runtime_runner():

        try:

            from . import runtime_service

            await runtime_service.async_start(
                hass,
                entry,
            )

        except Exception as error:

            platform[
                "runtime_state"
            ]="error"

            platform[
                "load_errors"
            ][
                "runtime"
            ]=(
                f"{type(error).__name__}: {error}"
            )

            _LOGGER.exception(
                "CloudPelizzon background runtime failed"
            )


    old_task=platform.get(
        "runtime_task"
    )


    if (
        old_task is None
        or
        old_task.done()
    ):

        platform[
            "runtime_task"
        ]=(
            hass.async_create_background_task(
                _runtime_runner(),
                "cloudpelizzon-runtime",
            )
        )


    #
    # --------------------------------------------------------
    # SECURITY AGENT V2.4
    #
    # AUDIT ONLY.
    #
    # Absolutely independent from the main runtime.
    # Failure here MUST NOT fail the config entry.
    # --------------------------------------------------------
    #
    async def _security_agent_runner():

        try:

            from .security_agent import (
                async_start as security_agent_start,
            )

            await security_agent_start(
                hass,
                entry,
            )

        except Exception as error:

            platform[
                "security_agent_state"
            ]="error"

            platform[
                "load_errors"
            ][
                "security_agent"
            ]=(
                f"{type(error).__name__}: {error}"
            )

            _LOGGER.exception(
                "CloudPelizzon Security Agent background warning"
            )


    security_task=platform.get(
        "security_agent_task"
    )


    if (
        security_task is None
        or
        security_task.done()
    ):

        platform[
            "security_agent_state"
        ]="starting"

        platform[
            "security_agent_task"
        ]=(
            hass.async_create_background_task(
                _security_agent_runner(),
                "cloudpelizzon-security-agent-audit",
            )
        )


    #
    # CRITICAL:
    #
    # Home Assistant receives success independently of:
    # - Runtime
    # - Security Agent
    # - Fleet
    # - remote Security Authority
    #
    return True


async def async_unload_entry(hass, entry) -> bool:
    """Unload the unified CloudPelizzon entry."""

    platform=hass.data.get(
        DOMAIN,
        {},
    )


    for task_name in (
        "security_agent_task",
        "runtime_task",
    ):

        task=platform.get(
            task_name
        )


        if (
            task
            and
            not task.done()
        ):

            task.cancel()


    try:

        from .security_agent import (
            async_stop as security_agent_stop,
        )

        await security_agent_stop(
            hass,
            entry,
        )

    except Exception:

        _LOGGER.exception(
            "CloudPelizzon Security Agent unload warning"
        )


    try:

        from . import runtime_service

        await runtime_service.async_stop(
            hass,
            entry,
        )

    except Exception:

        _LOGGER.exception(
            "CloudPelizzon runtime unload warning"
        )


    hass.data.pop(
        DOMAIN,
        None,
    )

    return True
