"""Mandatory Fleet registration for newly configured CloudPelizzon installations.

The Fleet handshake does not issue a commercial license. It fails closed.
Pairing codes are never written to logs or stored in configuration entries.
"""
from __future__ import annotations

import asyncio
import re

from homeassistant.const import __version__ as HA_VERSION
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.loader import async_get_integration

ENROLLMENT_URL = (
    "https://downloads.cloudpelizzon.com.br/fleet-gateway/api/v1/activate"
)
CODE_RE = re.compile(r"\ACP-[A-Z0-9]{6}(?:-[A-Z0-9]{6}){3}\Z", re.ASCII)
IID_RE = re.compile(r"\A[0-9a-f]{32}\Z", re.ASCII)


class FleetEnrollmentUnavailable(Exception):
    """Fleet is temporarily unavailable or responded unexpectedly."""


class FleetEnrollmentRejected(Exception):
    """Pairing code has been rejected by the Fleet authority."""


async def async_enroll(hass, *, installation_id: str, code: str) -> None:
    """Register one installation with a one-time Portal pairing code."""
    normalized = str(code or "").strip().upper()
    if not CODE_RE.fullmatch(normalized) or not IID_RE.fullmatch(installation_id):
        raise FleetEnrollmentRejected("invalid_code")

    integration = await async_get_integration(hass, "cloudpelizzon")
    version = str(integration.manifest.get("version") or "")
    session = async_get_clientsession(hass)
    try:
        async with asyncio.timeout(12):
            async with session.post(
                ENROLLMENT_URL,
                json={
                    "code": normalized,
                    "installation_id": installation_id,
                    "fleet_reporting_consent": True,
                    "cloudpelizzon_version": version,
                    "ha_version": HA_VERSION,
                },
                allow_redirects=False,
            ) as response:
                if response.status in (400, 403, 404, 409, 410, 422, 429):
                    raise FleetEnrollmentRejected("registration_rejected")
                if response.status != 200:
                    raise FleetEnrollmentUnavailable("fleet_http_error")
                result = await response.json(content_type="application/json")
    except FleetEnrollmentRejected:
        raise
    except asyncio.CancelledError:
        raise
    except FleetEnrollmentUnavailable:
        raise
    except Exception as exc:
        raise FleetEnrollmentUnavailable("fleet_unavailable") from exc

    if (
        not isinstance(result, dict)
        or result.get("ok") is not True
        or result.get("status") != "registered"
        or result.get("installation_id") != installation_id
    ):
        raise FleetEnrollmentUnavailable("invalid_fleet_response")
