"""Public Lighting transport. Business rules and Trial authority remain remote.

The public UI is verified by the same closed inventory as the other four modules.
No operator-only homologation trust packet is distributed or bypassed.
"""
from .signed_port import SignedLightingPort
from .native_scope import NativeLightingReadScope
from .inventory_uplink import NativeInventoryUplink
from .ha_inventory import NativeInventory
from . import native_ws

async def attach(hass,context,bridge):
 from pathlib import Path
 from homeassistant.components import websocket_api
 import probatio
 from ..ui_inventory import verify
 root=Path(__file__).resolve().parents[1]
 verified=await hass.async_add_executor_job(verify,root)
 if verified['files']<1:raise PermissionError('verified_public_UI_required')
 closed=[False]
 port=SignedLightingPort(hass,context['client'],package_ready=lambda:not closed[0])
 def uplink(hass,signed_port):return NativeInventoryUplink(hass,signed_port,NativeInventory)
 close_ws=native_ws.register(hass,port,NativeLightingReadScope,websocket_api=websocket_api,
  schema=probatio,inventory_uplink_type=uplink)
 old_fetch,old_installed=bridge.fetch_verified,bridge.installed
 async def fetch():return await port._run(port.verified_status)
 closers=[close_ws]
 try:
  bridge.fetch_verified=fetch;bridge.installed=old_installed|{'CP-LIGHTING'}
 except BaseException:
  for close in reversed(closers):close()
  port.close();closed[0]=True;bridge.fetch_verified=old_fetch;bridge.installed=old_installed
  raise
 def close():
  if closed[0]:return
  closed[0]=True
  for closer in reversed(closers):closer()
  port.close()
  if bridge.fetch_verified is fetch:bridge.fetch_verified=old_fetch;bridge.installed=old_installed
 return close
