"""CP-LIGHTING public WebSocket boundary, inactive until private signed port injection.

Last updated: 2026-10-20. Never start a Trial, register rights, mutate HA
states, trust browser actor/installation or implement a local commercial engine.
The existing private gateway MUST validate signed proofs for every attempt.
"""
from __future__ import annotations

import asyncio
import json
import re
from collections.abc import Mapping
from typing import Any

SKU = "CP-LIGHTING"
SNAPSHOT = "cloudpelizzon/lighting/v1/snapshot"
OPERATION = "cloudpelizzon/lighting/v1/operation"
KEY = "cloudpelizzon_lighting_native_v1"
IDENTIFIER = re.compile(r"[a-zA-Z0-9_-]{1,128}\Z")
ENTITY = re.compile(r"(?:light|switch|binary_sensor)\.[a-z0-9_]{1,128}\Z")
READ_POLICY = "read"
MAX_SIZE = 65536

ALLOWED = frozenset((
    "lighting.entities.discover",
    "lighting.room.create", "lighting.room.update", "lighting.entity.bind",
    "lighting.entity.configure", "lighting.entities.assign_room",
    "lighting.preferences.write",
))


class LightingNativeDenied(Exception):
    """A constant, non-sensitive failure for all denied operations."""

    def __init__(self):
        super().__init__("lighting_denied_or_unavailable")


def _record(v: Any) -> bool:
    return type(v) is dict


def _detached(v: Any, limit: int = MAX_SIZE) -> Any:
    try:
        encoded = json.dumps(v, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
        if len(encoded.encode("utf-8")) > limit:
            raise LightingNativeDenied()
        return json.loads(encoded)
    except (TypeError, ValueError, RecursionError):
        raise LightingNativeDenied() from None


def _authorized_user(connection: Any, user: Any) -> bool:
    return (
        user is not None
        and getattr(connection, "user", None) is user
        and getattr(connection, "closed", False) is not True
        and getattr(user, "is_active", False) is True
        and getattr(user, "system_generated", False) is not True
        and type(getattr(user, "id", None)) is str
        and bool(IDENTIFIER.fullmatch(user.id))
    )


def _can_read(user: Any, entity_id: str) -> bool:
    if type(entity_id) is not str or not ENTITY.fullmatch(entity_id):
        return False
    if getattr(user, "is_admin", False) is True:
        return True  # Match HA get_states permission scope for admin users.
    checker = getattr(getattr(user, "permissions", None), "check_entity", None)
    return callable(checker) and checker(entity_id, READ_POLICY) is True


class NativeLightingTransport:
    """Native HA boundary; the supplied `signed_port` remains proprietary.

    signed_port interface:
      .registration_ready() -> bool
      .installation_id() -> trusted installation ID (not from UI)
      .issue_grant(iid, actor, operation) -> fresh gateway VERIFIED claim
      .read_page(iid, actor, parameters, rid) -> SDK/proof gated config read
      .state_get(entity_id) -> hass.states.get, local read only
      .execute(iid, actor, op, parameters, rid) -> SDK/proof gated operation

    Each execute MUST validate 2 independent proofs, actor ACL, installed SKU,
    expiry/revocation and result freshness. This public boundary cannot prove
    those conditions itself and never creates a substitute signature.
    """

    def __init__(self, hass: Any, signed_port: Any, read_scope_type: Any, *, inventory_uplink_type=None):
        if not all(callable(getattr(signed_port, name, None)) for name in (
            "registration_ready", "installation_id", "issue_grant", "read_page", "state_get", "execute"
        )):
            raise LightingNativeDenied()
        if signed_port.registration_ready() is not True:
            raise LightingNativeDenied()
        if not callable(read_scope_type):
            raise LightingNativeDenied()
        self.hass, self.port = hass, signed_port
        self.scope = read_scope_type(
            installation_id=signed_port.installation_id,
            issue_grant=signed_port.issue_grant,
            read_page=signed_port.read_page,
            state_get=signed_port.state_get,
        )
        self.uplink = inventory_uplink_type(hass, signed_port) if inventory_uplink_type is not None else None
        if self.uplink is not None and not callable(getattr(self.uplink, 'prepare', None)):
            raise LightingNativeDenied()
        self.closed = False

    async def _current(self, connection: Any, user: Any) -> Any:
        if self.closed or not _authorized_user(connection, user):
            raise LightingNativeDenied()
        getter = getattr(getattr(self.hass, "auth", None), "async_get_user", None)
        if not callable(getter):
            raise LightingNativeDenied()
        current = await getter(user.id)
        if (not _authorized_user(connection, user) or current is None
                or current.id != user.id or current.is_active is not True
                or getattr(current, "system_generated", False) is True):
            raise LightingNativeDenied()
        return current

    async def run(self, connection: Any, msg: dict) -> dict:
        user = getattr(connection, "user", None)
        try:
            if not _record(msg) or type(msg.get("type")) is not str:
                raise LightingNativeDenied()
            await self._current(connection, user)
            iid = self.port.installation_id()
            if type(iid) is not str or not IDENTIFIER.fullmatch(iid):
                raise LightingNativeDenied()
            if msg["type"] == SNAPSHOT:
                if set(msg) != {"type", "id"}:
                    raise LightingNativeDenied()
                result = await self.scope.snapshot(connection)
                current = await self._current(connection, user)
                if self.port.installation_id() != iid:
                    raise LightingNativeDenied()
                # Permission changes in HA's user directory can occur while the
                # private read is awaiting. Never return stale actor metadata.
                if (not _record(result) or not _record(result.get("configuration"))
                        or type(result["configuration"].get("items")) is not list
                        or any(not _can_read(current, row.get("entity_id"))
                               for row in result["configuration"]["items"])):
                    raise LightingNativeDenied()
                return _detached(result, 524288)
            if msg["type"] != OPERATION or set(msg) != {
                "type", "id", "operation", "parameters", "request_id"
            }:
                raise LightingNativeDenied()
            operation, rid, parameters = msg["operation"], msg["request_id"], msg["parameters"]
            if (type(operation) is not str or operation not in ALLOWED
                    or type(rid) is not str or not IDENTIFIER.fullmatch(rid)
                    or not _record(parameters)):
                raise LightingNativeDenied()
            parameters = _detached(parameters)
            if any(key in parameters for key in (
                    "actor_id", "installation_id", "iid", "user_id", "proofs",
                    "grant", "license", "sku")):
                raise LightingNativeDenied()
            targets = []
            if operation in ("lighting.entity.bind", "lighting.entity.configure"):
                targets = [parameters.get("entity_id")]
            elif operation == "lighting.entities.assign_room":
                targets = parameters.get("entity_ids", [])
                if not isinstance(targets, list) or len(targets) > 100:
                    raise LightingNativeDenied()
            if any(not _can_read(user, eid) for eid in targets):
                raise LightingNativeDenied()
            if operation in ('lighting.entities.discover', 'lighting.entity.bind'):
                if self.uplink is None:
                    raise LightingNativeDenied()  # Never use empty/default inventory.
                await self.uplink.prepare(connection, iid, user.id, rid,
                    target_entity_id=parameters.get('entity_id') if operation=='lighting.entity.bind' else None)
                await self._current(connection, user)
                if self.port.installation_id() != iid:
                    raise LightingNativeDenied()
            result = await self.port.execute(iid, user.id, operation, parameters, rid)
            current = await self._current(connection, user)
            if self.port.installation_id() != iid or any(
                    not _can_read(current, eid) for eid in targets):
                # This withholds the result; the private gateway is also
                # responsible for reauthorizing before committing any mutation.
                raise LightingNativeDenied()
            value = _detached(result)
            if operation == "lighting.entities.discover":
                if not _record(value) or set(value) != {"items", "total"}:
                    raise LightingNativeDenied()
                if (not isinstance(value["items"], list)
                        or type(value["total"]) is not int or not 0 <= value["total"] <= 2000
                        or len(value["items"]) > 100):
                    raise LightingNativeDenied()
                # Fail the entire page if private inventory leaked an unauthorized
                # entity, rather than returning partial results/global counts.
                clean = []
                for x in value["items"]:
                    if (not _record(x) or set(x) != {"entity_id", "name", "kind", "capabilities"}
                            or not _can_read(user, x.get("entity_id"))
                            or not _can_read(current, x.get("entity_id"))
                            or type(x.get("name")) is not str
                            or not 0 < len(x["name"]) <= 80
                            or not x["name"].isprintable()
                            or x.get("kind") not in ("light", "review", "sensor")
                            or type(x.get("capabilities")) is not list
                            or x["capabilities"] not in ([], ["on_off"])):
                        raise LightingNativeDenied()
                    clean.append({"entity_id": x["entity_id"], "name": x["name"],
                                  "kind": x["kind"], "capabilities": x["capabilities"]})
                return {"items": clean, "total": value["total"]}
            if (not _record(value) or set(value) != {"saved", "revision"}
                    or value["saved"] is not True
                    or type(value["revision"]) is not int or value["revision"] < 0):
                raise LightingNativeDenied()
            return value
        except asyncio.CancelledError:
            raise
        except Exception:
            raise LightingNativeDenied() from None

    def close(self) -> None:
        self.closed = True


async def dispatch(hass: Any, connection: Any, msg: dict):
    transport = hass.data.get(KEY)
    if transport is None:
        connection.send_error(msg.get("id"), "lighting_denied_or_unavailable", "Módulo indisponível.")
        return
    try:
        result = await transport.run(connection, msg)
        if transport.closed or hass.data.get(KEY) is not transport:
            raise LightingNativeDenied()
        connection.send_result(msg["id"], result)
    except asyncio.CancelledError:
        raise
    except Exception:
        connection.send_error(msg.get("id"), "lighting_denied_or_unavailable", "Módulo indisponível.")


def register(hass: Any, signed_port: Any, read_scope_type: Any, *, websocket_api: Any, schema: Any, inventory_uplink_type=None):
    """Explicit native registration only when private port already attests ready.

    Public runtime must NEVER call this with a default/dummy port. Close owns only
    the commands it installed and preserves other integrations' handlers.
    """
    registry = hass.data.get(websocket_api.DOMAIN, {})
    if KEY in hass.data or SNAPSHOT in registry or OPERATION in registry:
        raise LightingNativeDenied()
    transport = NativeLightingTransport(hass, signed_port, read_scope_type,
                                        inventory_uplink_type=inventory_uplink_type)
    registered: dict[str, Any] = {}
    hass.data[KEY] = transport

    def close():
        transport.close()
        if hass.data.get(KEY) is transport:
            hass.data.pop(KEY, None)
        current = hass.data.get(websocket_api.DOMAIN, {})
        for key, handler in registered.items():
            if key in current and current[key][0] is handler:
                current.pop(key)

    try:
        for name, cmd_schema in (
            (SNAPSHOT, {schema.Required("type"): SNAPSHOT}),
            (OPERATION, {
                schema.Required("type"): OPERATION,
                schema.Required("operation"): str,
                schema.Required("parameters"): dict,
                schema.Required("request_id"): str,
            }),
        ):
            async def handler(hass, connection, msg):
                await dispatch(hass, connection, msg)
            fn = websocket_api.websocket_command(cmd_schema)(websocket_api.async_response(handler))
            websocket_api.async_register_command(hass, fn)
            registered[name] = fn
    except BaseException:
        close()
        raise
    return close
