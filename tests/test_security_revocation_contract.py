"""CI regression: revoked security keeps disarm only with protected private code."""
from __future__ import annotations

import runpy
import tempfile
from pathlib import Path


def write_files(target: Path, *, guarded: bool) -> None:
    cond = 'if not await is_module_authorized(self.hass, "CP-SECURITY"): raise HomeAssistantError("commercial_license_denied")'
    if not guarded:
        cond = "if False: raise HomeAssistantError('not protected')"

    (target / "engine.py").write_text(
        "class AlarmRuntime:\n"
        "    async def async_arm_home(self):\n"
        f"        {cond}\n"
        "        return 'armed'\n"
        "    async def async_arm_away(self):\n"
        f"        {cond}\n"
        "        return 'armed'\n"
        "    async def async_disarm(self):\n"
        "        return 'disarmed'\n"
        "    async def _finish_arming(self, final_state, delay, reason, source):\n"
        "        try:\n"
        "            await asyncio.sleep(delay)\n"
        + ((
          "            if not await is_module_authorized(self.hass, 'CP-SECURITY'):\n"
          "                await self.async_disarm()\n"
          "                return\n"
        ) if guarded else "") +
        "            await self.async_set_state(final_state, reason=reason, source=source)\n"
        "        except asyncio.CancelledError:\n"
        "            return\n"
        "        finally:\n"
        "            self._arming_task = None\n",
        encoding="utf-8",
    )
    reg = (
        "class Manager:\n"
        "    def _register(self, service, handler):\n"
        "        if getattr(handler, '__name__', '') in {'_service_armar_parcial', '_service_armar_total'}:\n"
        "            async def _cloudpelizzon_guarded_service(call):\n"
        f"                {cond}\n"
        "                return handler(call)\n"
        "            handler = _cloudpelizzon_guarded_service\n"
        "        return handler\n"
    )
    (target / "manager.py").write_text(reg, encoding="utf-8")
    (target / "api_configuracao.py").write_text(
        "class ConfiguracaoSegurancaView:\n"
        "    async def get(self, request):\n"
        f"        {cond}\n"
        "        return 200\n"
        "    async def post(self, request):\n"
        f"        {cond}\n"
        "        return 200\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    path = Path(__file__).parents[1] / "custom_components" / "cloudpelizzon" / "core" / "security_contract.py"
    verify = runpy.run_path(str(path))["private_emergency_runtime_verified"]
    with tempfile.TemporaryDirectory() as dirname:
        directory = Path(dirname)
        assert not verify(directory), "Missing private security package must fail closed"
        write_files(directory, guarded=True)
        assert verify(directory), "Protected security must retain emergency runtime"
        write_files(directory, guarded=False)
        assert not verify(directory), "Legacy unprotected arming must not start with revoked license"
    print("PASS: protected security emergency startup; unguarded private package rejected")
