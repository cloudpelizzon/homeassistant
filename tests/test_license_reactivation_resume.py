"""Offline CI regression for reinstatement without restarting Home Assistant."""
from __future__ import annotations

import ast
import asyncio
import runpy
import tempfile
import types
from pathlib import Path

ROOT = Path(__file__).parents[1]
REACTIVATION = ROOT / "custom_components/cloudpelizzon/core/reactivation.py"
LICENSE = ROOT / "custom_components/cloudpelizzon/core/license.py"


def assert_trigger_wired():
    tree = ast.parse(LICENSE.read_text(encoding="utf-8"))
    found = {}
    for cls in ast.walk(tree):
        if isinstance(cls, ast.ClassDef) and cls.name == "LicenseManager":
            for fn in cls.body:
                if isinstance(fn, ast.AsyncFunctionDef):
                    found[fn.name] = ast.unparse(fn)
    for name in ("async_checkin", "async_activate"):
        assert "schedule_reactivation_resume" in found[name], (
            f"LicenseManager.{name} does not trigger a runtime resume"
        )
    assert 'result.get("ok") is True' in found["async_checkin"]
    assert "coalesced" not in found["async_checkin"].split(
        "schedule_reactivation_resume"
    )[0][-250:]


async def regression():
    module = runpy.run_path(str(REACTIVATION))
    schedule = module["schedule_reactivation_resume"]
    needs = module["_needs_runtime_resume"]
    class Manager:
        def __init__(self):
            self.data = {"online_status": "active"}
            self.allowed = True

        def status_sync(self, sku, *, installed):
            assert sku == "CP-MAINTENANCE" and installed
            return {"allowed": self.allowed}

    class Hass:
        def __init__(self, manager):
            self.reload_ids = []
            self.manager = manager
            self.tasks = []
            self.data = {
                "cloudpelizzon": {
                    "runtime_state": "running",
                    "entry_id": "entry-test",
                    "optional_modules": {"maintenance": "license_denied:revoked"},
                    "core": {
                        "license_manager": manager,
                        "control": types.SimpleNamespace(mode="enforce"),
                    },
                }
            }
            self.config_entries = types.SimpleNamespace(async_reload=self.reload)

        async def reload(self, entry_id):
            self.reload_ids.append(entry_id)
            return True

        def async_create_background_task(self, coroutine, name):
            assert name == "cloudpelizzon-reactivation-runtime-resume"
            task = asyncio.create_task(coroutine)
            self.tasks.append(task)
            return task

    with tempfile.TemporaryDirectory() as folder:
        glob = schedule.__globals__
        glob["MODULES_ROOT"] = Path(folder)
        (Path(folder) / "maintenance").mkdir()

        manager = Manager()
        hass = Hass(manager)

        manager.data["online_status"] = "revoked"
        assert not schedule(hass), "Revoked check-in must never load a runtime"
        manager.data["online_status"] = "active"
        manager.allowed = False
        assert not schedule(hass), "Absent SKU entitlement cannot trigger reload"
        manager.allowed = True

        assert needs(hass)
        assert schedule(hass), "Fresh active entitlement must schedule reload"
        assert not schedule(hass), "No concurrent duplicate reloads"
        await hass.tasks[0]
        assert hass.reload_ids == ["entry-test"], "Only CP entry must be reloaded"
        assert not schedule(hass), "Cooldown must prevent restart loop"

        # If the module is already operational, it resumes through its guards.
        platform = hass.data["cloudpelizzon"]
        platform["maintenance"] = {"runtime": "loaded"}
        platform["reactivation_reload_last"] = 0
        assert not schedule(hass)

        platform.pop("maintenance")
        platform["optional_modules"]["maintenance"] = "not_installed"
        assert not schedule(hass), "Absent module must never be reloaded"

        platform["optional_modules"]["maintenance"] = "license_denied:revoked"
        platform["runtime_state"] = "starting"
        assert not schedule(hass), "Never reload before startup has finished"

    print("PASS: reinstatement reloads only CloudPelizzon, once, after active license")


if __name__ == "__main__":
    assert_trigger_wired()
    asyncio.run(regression())
