"""Composition root: the common catalog wraps validated legacy delegates once."""
from pathlib import Path
from . import module_coordinator253 as legacy_common
from . import private_modules216 as legacy_native
from .module_registry294 import Registry
from .module_coordinator295 import attach_catalog
from .engine_hooks298 import ENGINE_HOOKS
from .module_package243 import sha
from .module_profile298 import REGISTRY_SHA,ENGINE_PROFILES
from .tenant_migration246 import safe

async def register(hass,entry,context):
 path=safe(Path(__file__).with_name('module_registry294.json'))
 if sha(path.read_bytes())!=REGISTRY_SHA:raise PermissionError('reviewed_module_registry_required')
 registry=Registry.load(path)
 close_legacy=await legacy_common.register(hass,entry,context);close_catalog=None
 try:
  legacy=hass.data[legacy_native.KEY];bridge=hass.data['cloudpelizzon']['core']['status_transport'];adapters={}
  for spec in registry.modules():
   hooks=ENGINE_HOOKS.get(spec.runtime_adapter)
   if hooks is None or hooks.paid_factory is None:continue
   profile=ENGINE_PROFILES[spec.sku]
   if profile['manifest_sha256']!=spec.release_manifest_sha256:raise PermissionError('reviewed_engine_profile_required')
   adapters[spec.runtime_adapter]=hooks.paid_factory(hass,spec,profile['operations'])
  slots,close_catalog=attach_catalog(hass,context,legacy,bridge,registry,adapters)
  for slot in slots.values():
   try:await slot.restore()
   except Exception:pass
  def close():close_catalog();close_legacy()
  return close
 except BaseException:
  if close_catalog:close_catalog()
  close_legacy();raise
