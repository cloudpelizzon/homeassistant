"""Updater must not list or install commercial modules with denied licensing."""
from __future__ import annotations

import ast
import runpy
import types
from pathlib import Path


def main():
    source = Path(__file__).parents[1] / "custom_components/cloudpelizzon/updater/manager.py"
    tree = ast.parse(source.read_text(encoding="utf-8"))
    cls = next(x for x in tree.body if isinstance(x, ast.ClassDef) and x.name == "UpdateManager")
    targets = {"_commercial_entitled", "_require_commercial_entitlement", "status"}
    methods = [x for x in cls.body if isinstance(x, (ast.FunctionDef, ast.AsyncFunctionDef)) and x.name in targets]
    assert len(methods) == len(targets)

    module = ast.fix_missing_locations(ast.Module(
        body=[
            ast.ClassDef(name="IsolatedUpdater", bases=[], keywords=[],
                         body=methods, decorator_list=[])
        ], type_ignores=[]
    ))
    class UpdateError(RuntimeError):
        pass
    namespace = {
        "COMPONENTS": {
            "CP-CORE": {"path": "core"},
            "CP-UPDATER": {"path": "updater"},
            "CP-MAINTENANCE": {"path": "modules/maintenance"},
            "CP-ENERGY": {"path": "modules/energy"},
            "CP-SECURITY": {"path": "modules/security"},
        },
        "PLATFORM_DOMAIN": "cloudpelizzon",
        "UpdateError": UpdateError,
        "_version_key": lambda v: tuple(int(x) for x in str(v or "0").split(".")[:3]),
        "VERSION": "test",
    }
    exec(compile(module, str(source), "exec"), namespace)
    klass = namespace["IsolatedUpdater"]

    class Manager:
        def __init__(self):
            self.allowed = {"CP-ENERGY", "CP-SECURITY"}
        def status_sync(self, sku, *, installed):
            assert installed
            return {"allowed": sku in self.allowed}

    licenses = Manager()
    updater = object.__new__(klass)
    updater.hass = types.SimpleNamespace(data={
        "cloudpelizzon": {"core": {
            "license_manager": licenses,
            "control": types.SimpleNamespace(mode="enforce"),
        }},
    })
    updater.data = {
        "releases": [
            {"sku": "CP-ENERGY", "version": "2.0.0"},
            {"sku": "CP-MAINTENANCE", "version": "2.0.0"},
            {"sku": "CP-SECURITY", "version": "2.0.0"},
        ],
        "backups": [
            {"sku": "CP-ENERGY", "backup_id": "1"},
            {"sku": "CP-MAINTENANCE", "backup_id": "2"},
        ],
        "history": [
            {"sku": "CP-ENERGY", "event": "installed"},
            {"sku": "CP-MAINTENANCE", "event": "installed"},
        ],
        "channel": "pilot",
    }
    updater.installed_components = lambda: {
        sku: {"sku": sku, "name": sku, "version": "1.0.0"}
        for sku in namespace["COMPONENTS"]
    }

    status = updater.status()
    visible = {x["sku"] for x in status["components"]}
    assert visible == {"CP-CORE", "CP-UPDATER", "CP-ENERGY", "CP-SECURITY"}
    assert "CP-MAINTENANCE" not in {x["sku"] for x in status["releases"]}
    assert not any(x["sku"] == "CP-MAINTENANCE" for x in status["backups"])
    assert not any(x["sku"] == "CP-MAINTENANCE" for x in status["history"])
    try:
        updater._require_commercial_entitlement("CP-MAINTENANCE")
    except UpdateError:
        pass
    else:
        raise AssertionError("Revoked module install/rollback gate not enforced")

    licenses.allowed.clear()
    status = updater.status()
    assert {x["sku"] for x in status["components"]} == {"CP-CORE", "CP-UPDATER"}
    assert status["releases"] == [] and status["backups"] == []
    assert updater._commercial_entitled("CP-ENERGY") is False

    licenses.allowed.add("CP-ENERGY")
    status = updater.status()
    assert any(x["sku"] == "CP-ENERGY" for x in status["components"])
    assert updater._commercial_entitled("CP-ENERGY")
    updater.hass.data["cloudpelizzon"]["core"]["control"].mode = "audit"
    assert not updater._commercial_entitled("CP-ENERGY"), "Audit cannot override denied enforcement"
    updater.hass.data["cloudpelizzon"] = {}
    assert not updater._commercial_entitled("CP-ENERGY"), "No authority must fail closed"
    print("PASS: revocation hides installed modules and backups; reactivation restores only licensed SKU")


if __name__ == "__main__":
    main()
