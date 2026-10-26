"""CP-LIGHTING public, inactive HA->private signed inventory batch adapter.

An authenticated native HA WebSocket request is REQUIRED. The injected private
signed_port owns Ed25519 signing, TWO distinct proofs, capability checks, user
binding, entitlement, Trial expiry, backend verification and signed receipts.
This module never issues grants, registers network endpoints or sends HA effects.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import re
import secrets
from collections.abc import Mapping
from typing import Any

BATCH_SIZE = 100
MAX_ITEMS = 2000
TIMEOUT = 45.0
IDENTIFIER = re.compile(r"[A-Za-z0-9_-]{1,128}\Z")
ENTITY = re.compile(r"(?:light|switch|binary_sensor)\.[a-z0-9_]{1,128}\Z")
CLASSES = frozenset(("motion", "occupancy", "presence"))


class InventoryUplinkDenied(Exception):
    def __init__(self):
        super().__init__("lighting_inventory_uplink_denied")


def digest(items: list[dict[str, Any]]) -> str:
    return hashlib.sha256(json.dumps(items, sort_keys=True, ensure_ascii=False,
                                     separators=(",", ":"), allow_nan=False).encode("utf-8")).hexdigest()


def _validate_items(items: Any) -> None:
    if type(items) is not list or len(items) > MAX_ITEMS:
        raise InventoryUplinkDenied()
    previous = ""
    for row in items:
        if type(row) is not dict or set(row) not in ({"entity_id", "name"},
                                                     {"entity_id", "name", "device_class"}):
            raise InventoryUplinkDenied()
        eid, name = row.get("entity_id"), row.get("name")
        if (type(eid) is not str or ENTITY.fullmatch(eid) is None
                or eid <= previous or type(name) is not str or not name.strip()
                or len(name) > 80 or not name.isprintable()):
            raise InventoryUplinkDenied()
        if eid.startswith("binary_sensor."):
            if set(row) != {"entity_id", "name", "device_class"} or row["device_class"] not in CLASSES:
                raise InventoryUplinkDenied()
        elif set(row) != {"entity_id", "name"}:
            raise InventoryUplinkDenied()
        previous = eid


class NativeInventoryUplink:
    """Explicit optional native port. Missing private verifier => deny discovery.

    signed_port MUST expose:
    - stage_inventory_page(iid, actor, request_id, batch_id, sha256, total,
                           offset, items, stage_id) -> True ONLY on verified
      signed gateway acknowledgement with fresh two-proof authorization;
    - seal_inventory(iid, actor, request_id, batch_id, sha256, stage_id)
      -> True ONLY after gateway recomputes digest and seals single-use batch.

    Both operations MUST be bound to CP-LIGHTING and the 7-day server Trial or
    paid license, and MUST reject replayed signed envelopes. A True from a
    mock port in unit tests proves only local choreography, NOT authorization.
    """

    def __init__(self, hass: Any, signed_port: Any, inventory_source_type: Any):
        if not callable(inventory_source_type) or not all(callable(getattr(signed_port, x, None))
                                                         for x in ("stage_inventory_page", "seal_inventory")):
            raise InventoryUplinkDenied()
        self.hass = hass
        self.port = signed_port
        self.inventory = inventory_source_type(hass)
        if not callable(getattr(self.inventory, "collect", None)):
            raise InventoryUplinkDenied()

    async def _current(self, connection: Any, iid: str, actor: str, rows: list) -> None:
        user = getattr(connection, "user", None)
        if (user is None or getattr(connection, "closed", False) is True
                or getattr(user, "id", None) != actor
                or getattr(user, "is_active", False) is not True
                or getattr(user, "system_generated", False) is True
                or self.port.installation_id() != iid):
            raise InventoryUplinkDenied()
        auth = getattr(getattr(self.hass, "auth", None), "async_get_user", None)
        if not callable(auth):
            raise InventoryUplinkDenied()
        current = await auth(actor)
        if (getattr(connection, "user", None) is not user
                or getattr(connection, "closed", False) is True
                or getattr(user, "id", None) != actor
                or getattr(user, "is_active", False) is not True
                or getattr(user, "system_generated", False) is True
                or self.port.installation_id() != iid
                or current is None or getattr(current, "id", None) != actor
                or getattr(current, "is_active", False) is not True
                or getattr(current, "system_generated", False) is True):
            raise InventoryUplinkDenied()
        for row in rows:
            eid = row["entity_id"]
            for identity in (user, current):
                if getattr(identity, "is_admin", False) is True:
                    continue
                permissions = getattr(identity, "permissions", None)
                check = getattr(permissions, "check_entity", None)
                if not callable(check) or check(eid, "read") is not True:
                    raise InventoryUplinkDenied()

    async def prepare(self, connection: Any, iid: str, actor: str, operation_rid: str, *, target_entity_id=None) -> str:
        if not all(type(x) is str and IDENTIFIER.fullmatch(x)
                   for x in (iid, actor, operation_rid)):
            raise InventoryUplinkDenied()
        try:
            async with asyncio.timeout(TIMEOUT):
                rows = await self.inventory.collect(connection)
                _validate_items(rows)
                if target_entity_id is not None:
                    if (type(target_entity_id) is not str or ENTITY.fullmatch(target_entity_id) is None
                            or target_entity_id.startswith("binary_sensor.")):
                        raise InventoryUplinkDenied()
                    rows = [row for row in rows if row["entity_id"] == target_entity_id]
                    if len(rows) != 1:
                        raise InventoryUplinkDenied()
                frozen = json.loads(json.dumps(rows, ensure_ascii=False, allow_nan=False))
                total = len(frozen)
                hash_value = digest(frozen)
                batch_id = secrets.token_hex(16)
                for offset in range(0, max(1, total), BATCH_SIZE):
                    await self._current(connection, iid, actor, frozen)
                    page = frozen[offset:offset + BATCH_SIZE]
                    accepted = await self.port.stage_inventory_page(
                        iid, actor, operation_rid, batch_id, hash_value,
                        total, offset, page, secrets.token_hex(16))
                    if accepted is not True:
                        raise InventoryUplinkDenied()
                await self._current(connection, iid, actor, frozen)
                accepted = await self.port.seal_inventory(
                    iid, actor, operation_rid, batch_id, hash_value,
                    secrets.token_hex(16))
                if accepted is not True:
                    raise InventoryUplinkDenied()
                await self._current(connection, iid, actor, frozen)
                return batch_id
        except asyncio.CancelledError:
            raise
        except Exception:
            # Any partially staged data expires privately. Never return partial
            # inventory/actor fields, and never call HA's service APIs.
            raise InventoryUplinkDenied() from None
