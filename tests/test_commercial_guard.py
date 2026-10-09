"""Central license guard regression without requiring a full Home Assistant."""
from __future__ import annotations

import asyncio
import runpy
import sys
import types
from pathlib import Path


def main():
    websocket_api = types.ModuleType("homeassistant.components.websocket_api")

    def async_response(func):
        def callback(hass, connection, msg):
            return asyncio.run(func(hass, connection, msg))
        return callback

    websocket_api.async_response = async_response
    homeassistant = types.ModuleType("homeassistant")
    homeassistant.__path__ = []
    components = types.ModuleType("homeassistant.components")
    components.__path__ = []
    components.websocket_api = websocket_api
    sys.modules["homeassistant"] = homeassistant
    sys.modules["homeassistant.components"] = components
    sys.modules["homeassistant.components.websocket_api"] = websocket_api

    path = Path(__file__).parents[1] / "custom_components" / "cloudpelizzon" / "core" / "commercial_guard.py"
    module = runpy.run_path(str(path))

    calls = []

    def original(hass, connection, msg):
        calls.append("executed")
        connection.send_result(msg["id"], "ok")

    class Manager:
        def __init__(self):
            self.allowed = True
            self.status = "active"
            self.checks = 0

        async def async_checkin(self, *, force=False):
            assert force is True
            self.checks += 1
            return {"status": self.status}

        def status_sync(self, sku, *, installed):
            assert sku == "CP-MAINTENANCE" and installed
            return {"allowed": self.allowed, "status": self.status}

    class Connection:
        def __init__(self):
            self.errors = []
            self.results = []

        def send_error(self, *args):
            self.errors.append(args)

        def send_result(self, *args):
            self.results.append(args)

    manager = Manager()

    class Control:
        mode = "enforce"
        def __init__(self):
            self.checks = 0
        async def authorize(self, sku, *, installed):
            self.checks += 1
            result = manager.status_sync(sku, installed=installed)
            return {"effective_allowed": result["allowed"]}

    control = Control()
    registry = {"maintenance/list": (original, False)}
    hass = types.SimpleNamespace(data={
        "websocket_api": registry,
        "cloudpelizzon": {"core": {"license_manager": manager, "control": control}},
    })
    assert module["registered_commands"](hass) == {"maintenance/list"}
    assert module["protect_new_commands"](hass, set(), "CP-MAINTENANCE") == ["maintenance/list"]
    handler, schema = registry["maintenance/list"]
    assert schema is False

    good = Connection()
    handler(hass, good, {"id": 1, "type": "maintenance/list"})
    assert good.results == [(1, "ok")]
    assert calls == ["executed"]

    manager.allowed = False
    manager.status = "revoked"
    denied = Connection()
    handler(hass, denied, {"id": 2, "type": "maintenance/list"})
    assert not denied.results
    assert denied.errors and denied.errors[0][1] == "commercial_license_denied"
    assert calls == ["executed"], "revoked handler must never be executed"
    assert manager.checks == 2
    assert control.checks == 2
    assert not module["is_module_authorized_cached"](hass, "CP-MAINTENANCE")
    manager.allowed = True
    manager.status = "active"
    assert module["is_module_authorized_cached"](hass, "CP-MAINTENANCE")
    manager.allowed = False
    manager.status = "revoked"

    # The same shared helper is mandatory at HTTP and background-job ingress.
    manager.allowed = True
    manager.status = "active"
    assert asyncio.run(module["is_module_authorized"](hass, "CP-MAINTENANCE"))
    manager.allowed = False
    manager.status = "revoked"
    assert not asyncio.run(module["is_module_authorized"](hass, "CP-MAINTENANCE"))

    # Missing licensing runtime also fails closed.
    hass.data["cloudpelizzon"] = {}
    missing = Connection()
    handler(hass, missing, {"id": 3, "type": "maintenance/list"})
    assert missing.errors and not missing.results
    print("PASS: registered WebSocket handlers are denied after revocation")


if __name__ == "__main__":
    main()
