"""Sensor platform for CloudPelizzon public bootstrap."""

from __future__ import annotations

import logging
from importlib import import_module
from pathlib import Path


_LOGGER = logging.getLogger(__name__)
_ROOT = Path(__file__).parent


async def _async_setup_optional(
    module_name,
    module_directory,
    hass,
    entry,
    async_add_entities,
):
    """Load an optional commercial platform only when installed."""

    if not (_ROOT / "modules" / module_directory).is_dir():
        return

    try:
        module = import_module(
            module_name,
            __package__,
        )

        await module.async_setup_entry(
            hass,
            entry,
            async_add_entities,
        )

    except Exception:
        _LOGGER.exception(
            "CloudPelizzon optional sensor failed: %s",
            module_directory,
        )


async def async_setup_entry(
    hass,
    entry,
    async_add_entities,
) -> None:
    """Set up installed CloudPelizzon sensor modules."""

    await _async_setup_optional(
        ".modules.energy.sensor",
        "energy",
        hass,
        entry,
        async_add_entities,
    )

    await _async_setup_optional(
        ".modules.security.sensor",
        "security",
        hass,
        entry,
        async_add_entities,
    )
