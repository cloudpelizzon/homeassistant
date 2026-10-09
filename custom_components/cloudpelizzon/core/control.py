"""CloudPelizzon centralized control layer.

CP-CONTROL V0.2.3

Responsibilities:
- centralized module authorization
- persistent installation inventory
- persistent authorization decisions
- privacy-minimized telemetry payload
- offline grace handling
- audit/enforce operating modes
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
import logging
from typing import Any
from pathlib import Path

from homeassistant.const import __version__ as HA_VERSION

from ..registry import component_directory, module_installed
from .const import (
    DEFAULT_OFFLINE_GRACE_SEC,
    MODULES,
    VERSION as CORE_VERSION,
)


_LOGGER = logging.getLogger(__name__)

CONTROL_VERSION = "0.2.3"

VALID_MODES = {
    "audit",
    "enforce",
}

AUTHORITATIVE_DENY = {
    "revoked",
    "expired",
    "invalid",
    "installation_mismatch",
    "not_registered",
}


def _platform_version() -> str:
    """Return the version of the unified CloudPelizzon integration."""

    try:
        manifest_path = (
            Path(__file__).resolve().parents[1]
            / "manifest.json"
        )

        payload = json.loads(
            manifest_path.read_text(
                encoding="utf-8"
            )
        )

        version = str(
            payload.get(
                "version"
            )
            or ""
        ).strip()

        if version:
            return version

    except Exception:
        pass

    return str(
        CORE_VERSION
    )


def _component_version(hass, sku: str) -> str:
    """Return component version from local manifest."""

    try:
        path = component_directory(hass, sku)

        if not path:
            return ""

        manifest = path / "manifest.json"

        if not manifest.is_file():
            return ""

        payload = json.loads(
            manifest.read_text(
                encoding="utf-8"
            )
        )

        return str(
            payload.get("version")
            or ""
        ).strip()

    except Exception:
        return ""


def _parse_dt(value: Any):
    if not value:
        return None

    try:
        text = str(value).replace(
            "Z",
            "+00:00",
        )

        dt = datetime.fromisoformat(
            text
        )

        if dt.tzinfo is None:
            dt = dt.replace(
                tzinfo=timezone.utc
            )

        return dt.astimezone(
            timezone.utc
        )

    except Exception:
        return None


class ControlLayer:
    """Single authorization authority for CloudPelizzon."""

    def __init__(
        self,
        hass,
        license_manager,
        store,
        *,
        mode: str = "audit",
    ) -> None:

        self.hass = hass
        self.license_manager = license_manager
        self.store = store
        self.data = store.data

        normalized = str(
            mode or "audit"
        ).strip().lower()

        if normalized not in VALID_MODES:
            normalized = "audit"

        self.mode = normalized

        self._decisions: dict[
            str,
            dict[str, Any],
        ] = {}

    @staticmethod
    def _utcnow_dt():
        return datetime.now(
            timezone.utc
        )

    @classmethod
    def _utcnow(cls) -> str:
        return cls._utcnow_dt().isoformat()

    def _state(self) -> dict:

        state = self.data.setdefault(
            "control_layer",
            {},
        )

        if not isinstance(
            state,
            dict,
        ):
            state = {}
            self.data[
                "control_layer"
            ] = state

        return state

    async def async_initialize(
        self,
    ) -> None:
        """Initialize persistent installation inventory."""

        now = self._utcnow()

        state = self._state()

        activation_first = _parse_dt(
            self.data.get(
                "license_activated_at"
            )
        )

        stored_first = _parse_dt(
            state.get(
                "first_seen"
            )
        )

        known_first_seen = [
            value
            for value in (
                stored_first,
                activation_first,
            )
            if value is not None
        ]

        state["first_seen"] = (
            min(
                known_first_seen
            ).isoformat()
            if known_first_seen
            else now
        )

        state.update({
            "version":
                CONTROL_VERSION,
            "mode":
                self.mode,
            "last_seen":
                now,
            "installation_id":
                self.license_manager.installation_id,
            "cloudpelizzon_version":
                _platform_version(),
            "ha_version":
                str(HA_VERSION),
        })

        installed = []

        module_inventory = {}

        for sku in MODULES:

            try:
                present = bool(
                    module_installed(
                        self.hass,
                        sku,
                    )
                )
            except Exception:
                present = False

            module_inventory[
                sku
            ] = {
                "installed":
                    present,
            }

            if present:
                installed.append(
                    sku
                )

        state[
            "installed_modules"
        ] = sorted(
            installed
        )

        current_modules = state.setdefault(
            "modules",
            {},
        )

        for sku, row in (
            module_inventory.items()
        ):

            existing = (
                current_modules.get(
                    sku
                )
            )

            if not isinstance(
                existing,
                dict,
            ):
                existing = {}

            existing[
                "installed"
            ] = row[
                "installed"
            ]

            current_modules[
                sku
            ] = existing

            existing[
                "version"
            ] = (
                _component_version(
                    self.hass,
                    sku,
                )
                if row[
                    "installed"
                ]
                else ""
            )

        state[
            "privacy"
        ] = {
            "schema":
                "minimal-v2",
            "contains_customer_name":
                False,
            "contains_entity_ids":
                False,
            "contains_ip_address":
                False,
            "contains_home_url":
                False,
        }

        await self.store.async_save()

    def _offline_grace(
        self,
        sku: str,
        decision: dict,
    ) -> dict:
        """Allow an expired lease temporarily during offline grace."""

        if bool(
            decision.get(
                "allowed",
                False,
            )
        ):
            return decision

        status = str(
            decision.get(
                "status"
            )
            or ""
        )

        reason = str(
            decision.get(
                "reason"
            )
            or ""
        )

        #
        # Nunca sobrescrever uma negacao
        # autoritativa do servidor.
        #
        authoritative = str(
            self.license_manager.data.get(
                "online_status"
            )
            or ""
        )

        if authoritative in AUTHORITATIVE_DENY:
            return decision

        #
        # O grace somente existe para
        # lease expirado por indisponibilidade.
        #
        if not (
            status == "lease_expired"
            or (
                status == "invalid"
                and reason == "lease_expired"
            )
        ):
            return decision

        lease_payload = (
            self.license_manager.data.get(
                "lease_payload"
            )
            or {}
        )

        valid_until = _parse_dt(
            lease_payload.get(
                "valid_until"
            )
        )

        if valid_until is None:
            return decision

        grace_seconds = int(
            self.license_manager.data.get(
                "offline_grace_sec"
            )
            or DEFAULT_OFFLINE_GRACE_SEC
            or 0
        )

        if grace_seconds <= 0:
            return decision

        grace_until = (
            valid_until
            + timedelta(
                seconds=grace_seconds
            )
        )

        now = self._utcnow_dt()

        if now > grace_until:
            return decision

        result = dict(
            decision
        )

        result.update({
            "allowed":
                True,
            "status":
                "offline_grace",
            "reason":
                "lease_expired_within_offline_grace",
            "sku":
                sku,
            "lease_valid_until":
                valid_until.isoformat(),
            "offline_grace_until":
                grace_until.isoformat(),
        })

        return result

    async def authorize(
        self,
        sku: str,
        *,
        installed: bool = True,
    ) -> dict[str, Any]:
        """Evaluate and persist module authorization."""

        sku = str(
            sku or ""
        ).strip()

        checked_at = self._utcnow()

        try:

            raw = (
                await self.license_manager.async_status(
                    sku,
                    installed=installed,
                )
            )

            if not isinstance(
                raw,
                dict,
            ):

                raw = {
                    "allowed":
                        False,
                    "status":
                        "invalid_response",
                    "reason":
                        "license_manager_invalid_response",
                    "sku":
                        sku,
                }

        except Exception as err:

            raw = {
                "allowed":
                    False,
                "status":
                    "control_error",
                "reason":
                    f"{type(err).__name__}:{err}",
                "sku":
                    sku,
            }

        raw_allowed = bool(
            raw.get(
                "allowed",
                False,
            )
        )

        decision = self._offline_grace(
            sku,
            raw,
        )

        entitlement_allowed = bool(
            decision.get(
                "allowed",
                False,
            )
        )

        effective_allowed = (
            entitlement_allowed
            if self.mode == "enforce"
            else True
        )

        result = dict(
            decision
        )

        result.update({
            "sku":
                sku,
            "raw_license_allowed":
                raw_allowed,
            "entitlement_allowed":
                entitlement_allowed,
            "effective_allowed":
                effective_allowed,
            "control_mode":
                self.mode,
            "checked_at":
                checked_at,
        })

        self._decisions[
            sku
        ] = result

        await self._persist_decision(
            sku,
            installed,
            result,
        )

        if entitlement_allowed:

            _LOGGER.info(
                "CloudPelizzon Control ALLOW "
                "sku=%s status=%s mode=%s",
                sku,
                result.get("status"),
                self.mode,
            )

        elif self.mode == "audit":

            _LOGGER.warning(
                "CloudPelizzon Control AUDIT-DENY "
                "sku=%s status=%s reason=%s "
                "(preservado por AUDIT)",
                sku,
                result.get("status"),
                result.get("reason"),
            )

        else:

            _LOGGER.error(
                "CloudPelizzon Control DENY "
                "sku=%s status=%s reason=%s",
                sku,
                result.get("status"),
                result.get("reason"),
            )

        return result

    async def _persist_decision(
        self,
        sku: str,
        installed: bool,
        result: dict,
    ) -> None:

        state = self._state()

        state[
            "last_seen"
        ] = self._utcnow()

        state[
            "mode"
        ] = self.mode

        modules = state.setdefault(
            "modules",
            {},
        )

        #
        # Persistimos apenas metadados
        # necessarios ao Control Center.
        # Nada de token, secret ou nome
        # do cliente.
        #
        modules[
            sku
        ] = {
            "version":
                _component_version(
                    self.hass,
                    sku,
                )
                if installed
                else "",
            "installed":
                bool(installed),
            "allowed":
                bool(
                    result.get(
                        "entitlement_allowed",
                        False,
                    )
                ),
            "effective_allowed":
                bool(
                    result.get(
                        "effective_allowed",
                        False,
                    )
                ),
            "status":
                str(
                    result.get(
                        "status"
                    )
                    or ""
                ),
            "reason":
                str(
                    result.get(
                        "reason"
                    )
                    or ""
                ),
            "last_checked_at":
                str(
                    result.get(
                        "checked_at"
                    )
                    or ""
                ),
            "license_id":
                str(
                    result.get(
                        "license_id"
                    )
                    or ""
                ),
            "expires_at":
                str(
                    result.get(
                        "expires_at"
                    )
                    or ""
                ),
            "lease_valid_until":
                str(
                    result.get(
                        "lease_valid_until"
                    )
                    or ""
                ),
            "offline_grace_until":
                str(
                    result.get(
                        "offline_grace_until"
                    )
                    or ""
                ),
        }

        await self.store.async_save()

    def decision(
        self,
        sku: str,
    ) -> dict[str, Any] | None:

        value = self._decisions.get(
            str(
                sku or ""
            )
        )

        return (
            dict(value)
            if isinstance(
                value,
                dict,
            )
            else None
        )

    def telemetry_payload(
        self,
    ) -> dict[str, Any]:
        """Build privacy-minimized telemetry payload."""

        state = self._state()

        modules = (
            state.get(
                "modules"
            )
            or {}
        )

        clean_modules = {}

        for sku, row in (
            modules.items()
        ):

            if not isinstance(
                row,
                dict,
            ):
                continue

            clean_modules[
                sku
            ] = {
                "version":
                    str(
                        row.get(
                            "version"
                        )
                        or ""
                    ),
                "effective_allowed":
                    bool(
                        row.get(
                            "effective_allowed"
                        )
                    ),
                "reason":
                    str(
                        row.get(
                            "reason"
                        )
                        or ""
                    ),
                "installed":
                    bool(
                        row.get(
                            "installed"
                        )
                    ),
                "allowed":
                    bool(
                        row.get(
                            "allowed"
                        )
                    ),
                "status":
                    str(
                        row.get(
                            "status"
                        )
                        or ""
                    ),
                "last_checked_at":
                    str(
                        row.get(
                            "last_checked_at"
                        )
                        or ""
                    ),
            }

        return {
            "schema_version":
                1,
            "installation_id":
                self.license_manager.installation_id,
            "control_version":
                CONTROL_VERSION,
            "control_mode":
                self.mode,
            "cloudpelizzon_version":
                _platform_version(),
            "ha_version":
                str(HA_VERSION),
            "first_seen":
                state.get(
                    "first_seen"
                ),
            "last_seen":
                state.get(
                    "last_seen"
                ),
            "installed_modules":
                list(
                    state.get(
                        "installed_modules"
                    )
                    or []
                ),
            "modules":
                clean_modules,
        }

    def snapshot(
        self,
    ) -> dict[str, Any]:

        return {
            "version":
                CONTROL_VERSION,
            "mode":
                self.mode,
            "installation_id":
                self.license_manager.installation_id,
            "decisions": {
                key:
                    dict(value)
                for key, value
                in self._decisions.items()
            },
            "telemetry":
                self.telemetry_payload(),
        }
