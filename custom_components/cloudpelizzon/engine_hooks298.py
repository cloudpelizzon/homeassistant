"""One trusted engine hook registration for Trial preparation and paid install.

Trial activation, duration and proofs remain in the existing native service.
Descriptors select registered Python objects; they never supply executable paths.
"""
from dataclasses import dataclass
from pathlib import Path
from .lighting_local296 import LightingAdapter
from .security_local300 import SecurityAdapter
from .automation_local302 import AutomationAdapter
from .module_registry294 import Registry
from .module_profile298 import REGISTRY_SHA
from .module_package243 import sha
from .tenant_migration246 import safe

async def unchanged(hass,context):pass
def no_refresh(hass,context):pass
async def automation_prepare(hass,context):await context['automation_edge'].prepare()
async def security_prepare(hass,context):await context['security_edge'].prepare()
def automation_refresh(hass,context):context['automation_edge'].refresh_status=True
def security_refresh(hass,context):context['security_edge'].refresh_status=True
async def lighting_prepare(hass,context):
 transport=hass.data.get('cloudpelizzon_lighting_native_v1')
 if transport is None or transport.closed or transport.port.registration_ready() is not True:raise PermissionError('verified_lighting_package_required')

@dataclass(frozen=True)
class EngineHooks:
 paid_factory:object
 prepare_trial:object
 trial_activated:object

ENGINE_HOOKS={
 'solar_legacy212':EngineHooks(None,unchanged,no_refresh),
 'maintenance253':EngineHooks(None,unchanged,no_refresh),
 'automation290':EngineHooks(AutomationAdapter,automation_prepare,automation_refresh),
 'security290':EngineHooks(SecurityAdapter,security_prepare,security_refresh),
 'lighting290':EngineHooks(LightingAdapter,lighting_prepare,no_refresh),
}
def hook(sku):
 path=safe(Path(__file__).with_name('module_registry294.json'))
 if sha(path.read_bytes())!=REGISTRY_SHA:raise PermissionError('reviewed_module_registry_required')
 spec=Registry.load(path).get(sku)
 if spec.runtime_adapter not in ENGINE_HOOKS:raise PermissionError('module_trial_adapter_not_connected')
 return ENGINE_HOOKS[spec.runtime_adapter]
async def prepare_trial(hass,context,sku):return await hook(sku).prepare_trial(hass,context)
def trial_activated(hass,context,sku):return hook(sku).trial_activated(hass,context)
