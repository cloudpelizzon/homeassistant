"""Inactive CP-LIGHTING native-read boundary. No routes, credentials or effects.

Reviewed-only adapter for wiring into an authenticated Home Assistant connection.
The injected issuer MUST independently verify a signed, current private grant;
this adapter never issues or authenticates commercial entitlements.
"""
from __future__ import annotations

import asyncio
import json
import re
import secrets
from collections.abc import Callable, Mapping
from typing import Any

SKU = "CP-LIGHTING"
READ_OP = "lighting.config.read"
READ_POLICY = "read"  # Home Assistant POLICY_READ; use its native constant at hookup.
ID = re.compile(r"[A-Za-z0-9_-]{1,128}\Z")
ENTITY = re.compile(r"(?:light|switch|binary_sensor)\.[a-z0-9_]{1,128}\Z")
THEMES = frozenset(("grafite", "flux", "neo-soft"))
ICONS = frozenset(("bulb", "pendant", "spot", "led", "wall", "floodlight", "sensor"))
MODES = frozenset(("onoff", "brightness", "color_temp", "white", "hs", "xy", "rgb", "rgbw", "rgbww"))
PAGE = 100
MAX_BINDINGS = 2000
MAX_RESULT_BYTES = 524288


class LightingReadDenied(Exception):
    """Intentionally constant public failure. Never include backend error bodies."""

    def __init__(self):
        super().__init__("lighting_read_unavailable")


def _record(value: Any) -> bool:
    return type(value) is dict


def _text(value: Any, maximum: int = 80) -> bool:
    return type(value) is str and bool(value.strip()) and len(value) <= maximum and value.isprintable()


def _detached(value: Any, limit: int = MAX_RESULT_BYTES) -> Any:
    raw = json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
    if len(raw.encode("utf-8")) > limit:
        raise LightingReadDenied()
    return json.loads(raw)


def _grant(value: Any) -> bool:
    """Display-only shape. Its authenticity MUST be established by issuer."""
    if not _record(value) or value.get("sku") != SKU or value.get("gateway_verified") is not True:
        return False
    if not set(value).issubset({"sku", "gateway_verified", "license", "trial"}):
        return False
    license_info, trial = value.get("license"), value.get("trial")
    if license_info is not None and (not _record(license_info) or set(license_info) != {"allowed"}):
        return False
    if trial is not None and (not _record(trial) or set(trial) != {"verified", "phase", "paid_confirmed"}):
        return False
    return (license_info is not None and license_info.get("allowed") is True) or (
        trial is not None and trial.get("verified") is True
        and trial.get("phase") == "trial_active" and trial.get("paid_confirmed") is False
    )


def _validated_page(page: Any, offset: int, snapshot: Any) -> dict[str, Any]:
    if not _record(page) or set(page) != {"revision", "rooms", "items", "total", "preferences"}:
        raise LightingReadDenied()
    revision, total = page["revision"], page["total"]
    if type(revision) is not int or revision < 0 or type(total) is not int or not 0 <= total <= MAX_BINDINGS:
        raise LightingReadDenied()
    if not _record(page["preferences"]) or set(page["preferences"]) != {"theme"} or page["preferences"]["theme"] not in THEMES:
        raise LightingReadDenied()
    rooms = page["rooms"]
    if type(rooms) is not list or len(rooms) > 200:
        raise LightingReadDenied()
    room_ids = set()
    for room in rooms:
        if not _record(room) or set(room) != {"id", "name"} or type(room["id"]) is not str or not ID.fullmatch(room["id"]) or not _text(room["name"]) or room["id"] in room_ids:
            raise LightingReadDenied()
        room_ids.add(room["id"])
    items = page["items"]
    if type(items) is not list or len(items) != min(PAGE, total-offset):
        raise LightingReadDenied()
    for item in items:
        if not _record(item) or set(item) != {"entity_id", "name", "kind", "capabilities", "visible", "room_id", "icon"}:
            raise LightingReadDenied()
        eid = item["entity_id"]
        if type(eid) is not str or not ENTITY.fullmatch(eid) or not _text(item["name"]):
            raise LightingReadDenied()
        if type(item["visible"]) is not bool or item["icon"] not in ICONS:
            raise LightingReadDenied()
        if item["room_id"] is not None and item["room_id"] not in room_ids:
            raise LightingReadDenied()
        sensor = eid.startswith("binary_sensor.")
        if sensor:
            if item["kind"] != "sensor" or item["capabilities"] != []:
                raise LightingReadDenied()
        elif item["kind"] != "light" or item["capabilities"] != ["on_off"]:
            raise LightingReadDenied()
    marker = (revision, total, _detached(rooms), _detached(page["preferences"]))
    if snapshot is not None and marker != snapshot:
        raise LightingReadDenied()
    return {"marker": marker, "items": items}


def _attributes(value: Any) -> dict[str, Any]:
    """Allow only HA light capability fields; no history/device metadata."""
    attrs = value if isinstance(value, Mapping) else {}
    clean: dict[str, Any] = {}
    for key in ("brightness", "min_color_temp_kelvin", "max_color_temp_kelvin", "color_temp_kelvin"):
        number = attrs.get(key)
        if type(number) is int and 0 <= number <= 10000:
            clean[key] = number
    modes = attrs.get("supported_color_modes")
    if isinstance(modes, (list, tuple)) and 0 < len(modes) <= len(MODES) and all(isinstance(x, str) and x in MODES for x in modes) and len(set(modes)) == len(modes):
        clean["supported_color_modes"] = [str(x) for x in modes]
    mode = attrs.get("color_mode")
    if isinstance(mode, str) and mode in MODES:
        clean["color_mode"] = str(mode)
    return clean


class NativeLightingReadScope:
    """No registration: caller must supply HA connection and trusted private ports.

    \u0060issue_grant(iid, actor_id, operation)\u0060 authenticates a current signed private
    grant, including module readiness and Trial expiration, on *each* call.
    \u0060read_page(iid, actor_id, parameters, request_id)\u0060 invokes only the existing
    signed lighting.config.read operation, with authorization enforced by SDK.
    \u0060installation_id()\u0060 reads trusted runtime identity (never request fields).
    \u0060state_get(entity_id)\u0060 reads a local HA state, without calling services.
    """

    def __init__(self, *, installation_id: Callable, issue_grant: Callable,
                 read_page: Callable, state_get: Callable):
        if not all(callable(f) for f in (installation_id, issue_grant, read_page, state_get)):
            raise ValueError("trusted_ports_required")
        self._installation_id = installation_id
        self._issue_grant = issue_grant
        self._read_page = read_page
        self._state_get = state_get

    async def snapshot(self, connection: Any) -> dict[str, Any]:
        try:
            return await self._snapshot(connection)
        except asyncio.CancelledError:
            raise
        except Exception:
            raise LightingReadDenied() from None

    async def _snapshot(self, connection: Any) -> dict[str, Any]:
        user = getattr(connection, "user", None)
        actor_id = getattr(user, "id", None)
        iid = self._installation_id()
        if not (type(actor_id) is str and ID.fullmatch(actor_id) and
                type(iid) is str and ID.fullmatch(iid)):
            raise LightingReadDenied()

        def check_connection() -> None:
            if (getattr(connection, "user", None) is not user or
                    getattr(user, "is_active", None) is not True or
                    getattr(user, "system_generated", False) is True or
                    getattr(user, "id", None) != actor_id or
                    self._installation_id() != iid or
                    getattr(connection, "closed", False) is True):
                raise LightingReadDenied()

        def can_read(entity_id: str) -> bool:
            check_connection()
            if getattr(user, "is_admin", False) is True:
                return True  # Matches Home Assistant native get_states behavior.
            permissions = getattr(user, "permissions", None)
            checker = getattr(permissions, "check_entity", None)
            return callable(checker) and checker(entity_id, READ_POLICY) is True

        reference = None

        async def signed_grant() -> dict[str, Any]:
            nonlocal reference
            check_connection()
            value = await self._issue_grant(iid, actor_id, READ_OP)
            check_connection()
            if not _grant(value):
                raise LightingReadDenied()
            result = _detached(value, 2048)
            if reference is None:
                reference = result
            elif result != reference:
                raise LightingReadDenied()  # Revocation, conversion or actor scope change.
            return result

        grant = await signed_grant()
        items: list[dict[str, Any]] = []
        metadata = None
        seen = set()
        for _ in range(MAX_BINDINGS // PAGE):
            await signed_grant()
            offset = len(items)
            value = await self._read_page(iid, actor_id, {"offset": offset, "limit": PAGE}, secrets.token_hex(16))
            check_connection()
            page = _detached(value)
            validated = _validated_page(page, offset, metadata)
            metadata = validated["marker"]
            for item in validated["items"]:
                if item["entity_id"] in seen:
                    raise LightingReadDenied()
                seen.add(item["entity_id"])
                items.append(item)
            if len(items) == metadata[1]:
                break
        if metadata is None or len(items) != metadata[1]:
            raise LightingReadDenied()
        await signed_grant()
        filtered = [item for item in items if can_read(item["entity_id"])]
        room_ids = {item["room_id"] for item in filtered if item["room_id"] is not None}
        rooms = [room for room in metadata[2] if room["id"] in room_ids]
        configuration = {"revision": metadata[0], "rooms": rooms, "items": filtered,
                         "total": len(filtered), "preferences": metadata[3]}
        states: dict[str, dict[str, Any]] = {}
        for item in filtered:
            if item["kind"] == "sensor" or item["visible"] is False:
                continue
            entity_id = item["entity_id"]
            if not can_read(entity_id):
                raise LightingReadDenied()
            state = self._state_get(entity_id)
            if state is None:
                continue  # Configured but unavailable, never fabricate an on state.
            raw_id = getattr(state, "entity_id", None)
            raw_state = getattr(state, "state", None)
            if raw_id != entity_id:
                raise LightingReadDenied()
            state_str = raw_state if raw_state in ("on", "off", "unavailable", "unknown") else "unknown"
            states[entity_id] = {"entity_id": entity_id, "state": state_str,
                                 "attributes": _attributes(getattr(state, "attributes", None))}
        final_grant = await signed_grant()
        if final_grant != grant or any(not can_read(item["entity_id"]) for item in filtered):
            raise LightingReadDenied()
        return _detached({"sku": SKU, "grant": final_grant,
                          "states": states, "configuration": configuration})
