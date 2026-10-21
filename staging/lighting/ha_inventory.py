"""CP-LIGHTING: permission-scoped native HA inventory source (inactive).

No WebSocket route, remote gateway client, persistent storage or HA effects.
The private signed port may consume this inventory *only* after verifying the
installation, current authenticated HA actor, licensed SKU and operation.
"""
from __future__ import annotations

import asyncio
import re
from collections.abc import Mapping
from typing import Any

READ = "read"  # Home Assistant POLICY_READ
ENTITY = re.compile(r"(?:light|switch|binary_sensor)\.[a-z0-9_]{1,128}\Z")
VISIBLE_DOMAINS = frozenset(("light", "switch", "binary_sensor"))
PRESENCE_CLASSES = frozenset(("motion", "occupancy", "presence"))
MAX_ENTITIES = 2000
MAX_PAGE = 100


class InventoryUnavailable(Exception):
    def __init__(self):
        super().__init__("lighting_inventory_unavailable")


def _active(connection: Any, user: Any) -> bool:
    return (user is not None and connection.user is user
            and getattr(connection, "closed", False) is not True
            and getattr(user, "is_active", False) is True
            and getattr(user, "system_generated", False) is not True
            and isinstance(getattr(user, "id", None), str)
            and bool(re.fullmatch(r"[A-Za-z0-9_-]{1,128}", user.id)))


def _readable(user: Any, eid: str) -> bool:
    if getattr(user, "is_admin", False) is True:
        return True
    checker = getattr(getattr(user, "permissions", None), "check_entity", None)
    return callable(checker) and checker(eid, READ) is True


def _name(state: Any, eid: str) -> str:
    attributes = getattr(state, "attributes", None)
    raw = attributes.get("friendly_name") if isinstance(attributes, Mapping) else None
    if (not isinstance(raw, str) or not raw.strip() or len(raw) > 80
            or not raw.isprintable()):
        return eid
    return raw.strip()


def _shape(state: Any) -> dict[str, Any] | None:
    eid = getattr(state, "entity_id", None)
    if not isinstance(eid, str) or not ENTITY.fullmatch(eid):
        return None
    domain = eid.split(".", 1)[0]
    attrs = getattr(state, "attributes", None)
    attrs = attrs if isinstance(attrs, Mapping) else {}
    if domain == "binary_sensor" and attrs.get("device_class") not in PRESENCE_CLASSES:
        return None
    # Private configuration engine expects these fields; it derives kind and
    # never promotes a switch to a light without explicit operator approval.
    row = {"entity_id": eid, "name": _name(state, eid)}
    if domain == "binary_sensor":
        row["device_class"] = attrs["device_class"]
    return row


class NativeInventory:
    """A private signed port supplies the authenticated HA WebSocket session.

    The returned list is suitable for LightingConfiguration(...,inventory=...).
    The *private gateway* remains responsible for authenticating the signed
    installation, actor and two independent proofs, on every execution.
    """

    def __init__(self, hass: Any):
        self.hass = hass

    async def collect(self, connection: Any) -> list[dict[str, Any]]:
        user = getattr(connection, "user", None)
        try:
            if not _active(connection, user):
                raise InventoryUnavailable()
            auth = getattr(getattr(self.hass, "auth", None), "async_get_user", None)
            getter = getattr(getattr(self.hass, "states", None), "async_all", None)
            if not callable(auth) or not callable(getter):
                raise InventoryUnavailable()
            current = await auth(user.id)
            if not _active(connection, user) or not _active_user(current, user.id):
                raise InventoryUnavailable()
            rows = getter()
            if not isinstance(rows, (list, tuple)) or len(rows) > 100000:
                raise InventoryUnavailable()
            items: list[dict[str, Any]] = []
            seen: set[str] = set()
            for state in rows:
                row = _shape(state)
                if row is None:
                    continue
                eid = row["entity_id"]
                if eid in seen:
                    raise InventoryUnavailable()
                seen.add(eid)
                if not (_readable(user, eid) and _readable(current, eid)):
                    continue
                items.append(row)
                if len(items) > MAX_ENTITIES:
                    raise InventoryUnavailable()
            # Auth may change during entity enumeration; use fresh directory
            # state and repeat checks before releasing ANY room/name metadata.
            again = await auth(user.id)
            if not _active(connection, user) or not _active_user(again, user.id):
                raise InventoryUnavailable()
            if any(not (_readable(user, x["entity_id"]) and
                        _readable(again, x["entity_id"])) for x in items):
                raise InventoryUnavailable()
            return sorted(items, key=lambda x: x["entity_id"])
        except asyncio.CancelledError:
            raise
        except Exception:
            raise InventoryUnavailable() from None

    async def page(self, connection: Any, *, offset: int, limit: int = MAX_PAGE) -> dict[str, Any]:
        if (type(offset) is not int or offset < 0
                or type(limit) is not int or limit < 1 or limit > MAX_PAGE):
            raise InventoryUnavailable()
        rows = await self.collect(connection)
        return {"items": rows[offset:offset + limit], "total": len(rows)}


def _active_user(current: Any, actor_id: str) -> bool:
    return (current is not None and getattr(current, "id", None) == actor_id
            and getattr(current, "is_active", False) is True
            and getattr(current, "system_generated", False) is not True)
