"""Binary sensor platform for CloudPelizzon public bootstrap."""

from __future__ import annotations

import logging
from importlib import import_module
from pathlib import Path


_LOGGER = logging.getLogger(__name__)
_ROOT = Path(__file__).parent


async def async_setup_entry(
    hass,
    entry,
    async_add_entities,
) -> None:
    """Load residential security binary sensors only when installed."""

    if not (_ROOT / "modules" / "security").is_dir():
        return

    try:
        module = import_module(
            ".modules.security.binary_sensor",
            __package__,
        )

        await module.async_setup_entry(
            hass,
            entry,
            async_add_entities,
        )

    except Exception:
        _LOGGER.exception(
            "CloudPelizzon optional CP-SECURITY binary sensor failed"
        )
