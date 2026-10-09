"""Automatic Device Registry synchronization for CloudPelizzon modules."""

from __future__ import annotations

import json
import logging

from typing import Any

from homeassistant.helpers import device_registry as dr

from .const import DOMAIN
from .registry import (
    COMPONENTS,
    component_directory,
)


_LOGGER = logging.getLogger(__name__)


DEVICE_MANAGER_VERSION = "1.0.0"


def _manifest_payload(path) -> dict[str, Any]:
    """Read one installed module manifest."""

    manifest = path / "manifest.json"

    if not manifest.is_file():
        return {}

    try:
        payload = json.loads(
            manifest.read_text(
                encoding="utf-8"
            )
        )

        return (
            payload
            if isinstance(payload, dict)
            else {}
        )

    except Exception:
        return {}


def _device_name(
    sku: str,
    meta: dict,
    manifest: dict,
) -> str:
    """Return canonical module device name."""

    name = str(
        manifest.get("name")
        or meta.get("name")
        or sku
    ).strip()

    if name.lower().startswith(
        "cloudpelizzon"
    ):
        return name

    return (
        "CloudPelizzon "
        + name
    )


def _identifier(sku: str) -> str:
    """Canonical identifier shared by all modules."""

    return (
        str(sku)
        .strip()
        .lower()
        .replace("_", "-")
    )


def _is_internal_module(meta: dict) -> bool:
    """Only modules/* become customer-visible module devices."""

    path = str(
        meta.get("path")
        or ""
    ).strip()

    return path.startswith(
        "modules/"
    )


async def async_sync_module_devices(
    hass,
    entry,
) -> list[dict[str, str]]:
    """
    Discover installed CloudPelizzon modules and ensure one HA device
    exists for every installed module.

    This is intentionally independent from entities. Modules such as
    Maintenance therefore appear in Device Registry even when they do
    not expose sensor entities.
    """

    registry = dr.async_get(
        hass
    )

    registered = []

    for sku, meta in sorted(
        COMPONENTS.items()
    ):

        if not isinstance(
            meta,
            dict,
        ):
            continue

        #
        # Core and Update Center are platform infrastructure,
        # not customer module devices.
        #
        if not _is_internal_module(
            meta
        ):
            continue

        path = component_directory(
            hass,
            sku,
        )

        if not path:
            continue

        if not path.is_dir():
            continue

        manifest = _manifest_payload(
            path
        )

        #
        # A directory without a module manifest is considered
        # incomplete and must not become an HA device.
        #
        if not manifest:
            continue

        version = str(
            manifest.get("version")
            or ""
        ).strip()

        name = _device_name(
            sku,
            meta,
            manifest,
        )

        identifier = _identifier(
            sku
        )

        kwargs = {
            "config_entry_id":
                entry.entry_id,

            "identifiers": {
                (
                    DOMAIN,
                    identifier,
                )
            },

            "name":
                name,

            "manufacturer":
                "CloudPelizzon",

            "model":
                sku,
        }

        if version:

            kwargs[
                "sw_version"
            ] = version

        device = registry.async_get_or_create(
            **kwargs
        )

        registered.append({
            "device_id":
                device.id,

            "sku":
                sku,

            "identifier":
                identifier,

            "name":
                name,

            "version":
                version,
        })

    _LOGGER.info(
        "CloudPelizzon module devices synchronized: %s",
        ", ".join(
            row["sku"]
            for row in registered
        )
        or "none",
    )

    return registered
