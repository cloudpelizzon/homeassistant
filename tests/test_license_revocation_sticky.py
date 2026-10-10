"""Regression: errors cannot erase revocation; fresh signed CP2 is required."""
from __future__ import annotations

import ast
import asyncio
import hashlib
import hmac
import json
import runpy
import time
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


def build_checkin_methods():
    path = Path(__file__).parents[1] / "custom_components/cloudpelizzon/core/license.py"
    tree = ast.parse(path.read_text(encoding="utf-8"))
    cls = next(node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == "LicenseManager")
    names = {"_async_checkin_network", "_verify_new_online_lease"}
    methods = [n for n in cls.body if isinstance(n, ast.AsyncFunctionDef) and n.name in names
               or isinstance(n, ast.FunctionDef) and n.name in names]
    assert len(methods) == 2
    isolated = ast.fix_missing_locations(ast.Module(body=[
        ast.ClassDef(name="IsolatedManager", bases=[], keywords=[], body=methods, decorator_list=[])
    ], type_ignores=[]))
    namespace = {
        "datetime": datetime, "timezone": timezone,
        "time": time, "uuid4": uuid4,
        "hashlib": hashlib, "hmac": hmac, "json": json,
        "_b64url_encode": lambda data: "unused-hmac",
        "_parse_dt": lambda v: datetime.fromisoformat(str(v).replace("Z", "+00:00")) if v else None,
        "DEFAULT_CHECKIN_INTERVAL_SEC": 21600,
        "DEFAULT_OFFLINE_GRACE_SEC": 604800,
        "DENY_IMMEDIATELY": {"revoked", "expired", "invalid", "installation_mismatch", "not_registered"},
        "_decode_signed": lambda token, prefix: ("CP2", {
            "installation_id": "install",
            "activation_id": "activation",
            "license_id": "license",
            "valid_until": "2099-01-01T00:00:00+00:00",
            "modules": ["CP-MAINTENANCE"],
        }) if token == "valid-signed-CP2" else (_ for _ in ()).throw(ValueError("bad_signature")),
    }
    exec(compile(isolated, str(path), "exec"), namespace)
    return namespace["IsolatedManager"]


async def main():
    manager_type = build_checkin_methods()

    class Store:
        def __init__(self, data):
            self.data = data
            self.writes = 0
        async def async_save(self):
            self.writes += 1

    class Manager(manager_type):
        def __init__(self):
            self.data = {
                "activation_id": "activation",
                "activation_secret": "secret",
                "online_status": "revoked",
                "license_revision": 7,
                "license_token": "valid-cp1",
                "lease_token": "old-but-unexpired-lease",
            }
            self.store = Store(self.data)
            self.resp = None
        @property
        def installation_id(self):
            return "install"
        def _checkin_telemetry(self):
            return {}
        def _ha_version(self):
            return "2026.10.0"
        async def _post_json(self, path, payload):
            assert path == "checkin"
            return self.resp
        def decode_token(self, token):
            assert token == "valid-cp1"
            return {"license_id": "license", "modules": ["CP-MAINTENANCE"]}

    m = Manager()
    m.resp = (500, {"status": "http_500"})
    failure = await m._async_checkin_network()
    assert not failure["ok"]
    assert m.data["online_status"] == "revoked", "500 must never clear revoked"
    assert m.data["lease_token"] == "old-but-unexpired-lease"

    m.resp = (200, {"ok": True, "status": "active", "cp1_token": "valid-cp1"})
    missing = await m._async_checkin_network()
    assert not missing["ok"]
    assert m.data["online_status"] == "revoked", "active without signed CP2 must fail"

    m.resp = (200, {
        "ok": True, "status": "active", "cp1_token": "valid-cp1",
        "lease_token": "bad-signature", "license_revision": 8,
    })
    forged = await m._async_checkin_network()
    assert not forged["ok"]
    assert m.data["online_status"] == "revoked", "invalid CP2 must not reactivate"

    m.resp = (200, {
        "ok": True, "status": "active", "cp1_token": "valid-cp1",
        "lease_token": "valid-signed-CP2", "license_revision": 6,
    })
    rollback = await m._async_checkin_network()
    assert not rollback["ok"] and m.data["online_status"] == "revoked"

    m.resp = (200, {
        "ok": True, "status": "active", "cp1_token": "valid-cp1",
        "lease_token": "valid-signed-CP2", "license_revision": 8,
    })
    resumed = await m._async_checkin_network()
    assert resumed.get("ok") is True and m.data["online_status"] == "active", (
        "reactivation response rejected: "
        + repr(resumed)
        + " / "
        + repr(m.data.get("last_checkin_error"))
    )
    assert m.data["license_revision"] == 8
    assert m.data["lease_token"] == "valid-signed-CP2"

    m.resp = (403, {"status": "revoked"})
    revoked = await m._async_checkin_network()
    assert revoked["status"] == "revoked"
    assert m.data["online_status"] == "revoked"

    m.resp = (200, {"ok": True, "status": "active", "lease_token": ""})
    await m._async_checkin_network()
    assert m.data["online_status"] == "revoked"
    print("PASS: revoked is sticky; only current signed CP2 + monotonic revision restores")


if __name__ == "__main__":
    asyncio.run(main())
