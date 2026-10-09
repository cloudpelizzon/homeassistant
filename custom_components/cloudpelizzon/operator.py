"""CloudPelizzon operator-only access control."""

from __future__ import annotations

import hmac
import json

from pathlib import Path

from .const import DOMAIN


MARKER_FILE = "cloudpelizzon_operator_mode.json"


def _marker_path(hass) -> Path:
    return (
        Path(hass.config.path(".storage"))
        / MARKER_FILE
    )


def _current_installation_id(hass) -> str:

    platform = hass.data.get(DOMAIN)

    if not isinstance(platform, dict):
        return ""

    core = platform.get("core")

    if not isinstance(core, dict):
        return ""

    manager = core.get("license_manager")

    if manager is None:
        return ""

    return str(
        getattr(
            manager,
            "installation_id",
            "",
        )
        or ""
    )


def is_operator_mode(hass) -> bool:

    current = _current_installation_id(
        hass
    )

    if not current:
        return False

    path = _marker_path(hass)

    if not path.exists():
        return False

    try:

        marker = json.loads(
            path.read_text(
                encoding="utf-8"
            )
        )

    except Exception:

        return False

    expected = str(
        marker.get("installation_id")
        or ""
    )

    if not marker.get("enabled"):
        return False

    if (
        marker.get("role")
        != "cloudpelizzon_operator"
    ):
        return False

    if not expected:
        return False

    return hmac.compare_digest(
        current,
        expected,
    )
