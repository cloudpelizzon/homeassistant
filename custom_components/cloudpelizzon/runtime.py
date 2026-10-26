"""Root client lifecycle with signed local engines and native authority."""
from collections.abc import Mapping
from pathlib import Path
import re
from homeassistant.helpers.storage import Store
from .adapters.solar.identity import load_identity
from .adapters.solar.sdk import Client
from .public_core.bridge import CoreBridge
from .public_core import api
from . import frontend, public_trials, fleet_reporter, commercial
from .security import create as security_ui
from .public_automation import create as automation_ui
from .public_onboarding import api as handoff_api
from .public_onboarding.factory import create as onboarding

DOMAIN = 'cloudpelizzon'
OWNER = '_public_runtime73'
ROOT = Path(__file__).resolve().parent


async def load_context(hass):
    # Read the existing Core store; never generate/replace/merge identities.
    data = await Store(hass, 1, 'cloudpelizzon_core.data').async_load()
    core_id = data.get('installation_id') if isinstance(data, dict) else None
    if type(core_id) is not str or not re.fullmatch('[0-9a-f]{32}', core_id):
        raise ValueError('existing_core_identity_required')
    folder = Path(hass.config.path('.storage/cloudpelizzon_edge')).absolute()
    trial_id, key = await hass.async_add_executor_job(load_identity, folder)
    return {'core_id': core_id, 'trial_id': trial_id, 'client': Client(trial_id, key)}


async def solar(hass, entry):
    from .adapters.solar import async_setup_runtime
    from .ha_private212 import async_prepare
    await async_prepare(hass)
    return await async_setup_runtime(hass, entry)


async def maintenance(hass, entry):
    from .adapters.maintenance import async_setup_runtime
    return await async_setup_runtime(hass, entry)


def controllers(runtime):
    if not isinstance(runtime, dict):
        raise ValueError('invalid_module_runtime')
    if 'remote_controller' in runtime:
        return [runtime['remote_controller']]
    return [row['remote_controller'] for row in runtime.values()
            if isinstance(row, dict) and 'remote_controller' in row]


class Runtime:
    def __init__(self, hass, entry, *, root=None, factories=None):
        self.hass = hass
        self.entry = entry
        self.root = ROOT if root is None else root
        self.factories = factories if factories is not None else {'CP-SOLAR': solar, 'CP-MAINTENANCE': maintenance}
        self.state = {'entry_id': entry.entry_id, OWNER: self, 'core': {}}
        self.bridge = None
        self.closers = []
        self.closed = False
        self.sensor_forwarded = False
        self.native_forwarded = False
        self.stage = 'created'

    async def start(self):
        if (self.entry.domain != DOMAIN or DOMAIN in self.hass.data
                or not isinstance(self.entry.options, Mapping)):
            raise ValueError('existing_or_invalid_runtime')
        delivery = self.entry.options.get('maintenance_delivery', {})
        if not isinstance(delivery, Mapping) or delivery.get('enabled', False) is not False:
            # Cutover must not turn on notification effects from old options.
            raise ValueError('delivery_requires_separate_review')
        self.stage = 'load_identity'
        context = await load_context(self.hass)
        self.stage = 'core_bridge'
        self.bridge = CoreBridge.from_client(self.hass, context['client'],
            core_id=context['core_id'], installed=set(self.factories)|{'CP-AUTOMATION','CP-SECURITY'})
        self.state['core']['status_transport'] = self.bridge
        self.hass.data[DOMAIN] = self.state
        try:
            self.stage = 'lighting_transport'
            from .public_lighting import attach as attach_lighting
            original_status_fetch229=self.bridge.fetch_verified
            self.closers.append(await attach_lighting(self.hass, context, self.bridge))
            self.bridge.fetch_verified=original_status_fetch229
            self.bridge.local_ready=lambda: {'CP-SOLAR'} if self.hass.data.get('cloudpelizzon_private_local_ready216') else set()
            self.stage = 'core_websocket'
            self.closers.append(api.register(self.hass, self.bridge))
            self.stage = 'commercial_websocket'
            self.closers.append(commercial.register(self.hass, context['core_id']))
            from .profile_client229 import register as register_profile229
            self.closers.append(register_profile229(self.hass,context))
            self.stage = 'trial_websocket'
            from .engine_hooks298 import prepare_trial as prepare_registered_trial, trial_activated as registered_trial_activated
            async def prepare_trial(sku):await prepare_registered_trial(self.hass,context,sku)
            def trial_activated(sku):registered_trial_activated(self.hass,context,sku)
            self.closers.append(public_trials.register(self.hass, context['client'],prepare=prepare_trial,activated=trial_activated))
            self.stage = 'portal_fleet'
            handoff = await onboarding(self.hass, self.entry, context)
            self.closers.append(handoff.close)
            self.closers.append(handoff_api.register(self.hass, handoff))
            self.stage = 'automation'
            self.closers.append(await automation_ui(self.hass, self.entry, context))
            self.stage = 'security'
            self.closers.append(await security_ui(self.hass, self.entry, context))
            self.stage = 'native_security_entities'
            self.native_forwarded = True
            await self.hass.config_entries.async_forward_entry_setups(self.entry, ['alarm_control_panel','select'])
            self.stage = 'frontend'
            self.closers.append(await frontend.register(self.hass, self.root))
            # Register public transports independently of display permission.
            # Their SDK operations reauthorize on the server on every attempt.
            # An offline/expired display claim cannot start a local engine; nor
            # must a later legitimate grant require reinstalling its transport.
            for sku, factory in self.factories.items():
                self.stage = 'solar' if sku == 'CP-SOLAR' else 'maintenance'
                module = await factory(self.hass, self.entry)
                module_controllers = controllers(module)
                if not module_controllers:
                    raise ValueError('remote_controller_required')
                self.closers.extend(controller.close for controller in module_controllers)
                self.state['energy' if sku == 'CP-SOLAR' else 'maintenance'] = module
            if 'energy' in self.state:
                self.sensor_forwarded = True
                self.stage = 'sensor_platform'
                await self.hass.config_entries.async_forward_entry_setups(self.entry, ['sensor'])
            from .module_registration298 import register as register_private_installer
            self.closers.append(await register_private_installer(self.hass, self.entry, context))
            self.closers.append(fleet_reporter.start(self.hass, self.entry))
            self.entry.async_on_unload(self.close)
            return self
        except BaseException:
            if self.native_forwarded:
                try:await self.hass.config_entries.async_unload_platforms(self.entry, ['alarm_control_panel','select'])
                except Exception:pass
            if self.sensor_forwarded:
                try:
                    await self.hass.config_entries.async_unload_platforms(self.entry, ['sensor'])
                except Exception:
                    pass
            self.close()
            raise

    def close(self):
        if self.closed:
            return
        self.closed = True
        for close in reversed(self.closers):
            try:
                close()
            except Exception:
                # Continue closing independent owned resources after an error.
                pass
        self.closers.clear()
        if self.bridge:
            self.bridge.close()
        if self.hass.data.get(DOMAIN) is self.state:
            self.hass.data.pop(DOMAIN)

    async def unload(self):
        if self.closed:
            return True
        if self.native_forwarded:
            if not await self.hass.config_entries.async_unload_platforms(self.entry, ['alarm_control_panel','select']):return False
        if self.sensor_forwarded:
            ok = await self.hass.config_entries.async_unload_platforms(self.entry, ['sensor'])
            if not ok:
                return False
        self.close()
        return True
