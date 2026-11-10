"""Load the separately authorized Inventory package on public HACS installs."""
import hashlib
import json
import logging
from pathlib import Path

from .compiled_activation627 import recover_pending
from .compiled_loader627 import Namespace, canonical, safe
from .compiled_release628 import PUBLIC_KEY, RELEASES
from .compiled_runtime627 import LocalSDK

SKU = 'CP-INVENTORY'
KEY = 'cloudpelizzon_inventory_installed709'
_LOGGER = logging.getLogger(__name__)


def _verified_package(root, context):
    recover_pending(root)
    identity = json.loads(safe(root / 'identity.json').read_bytes())
    if identity != {'core_id': context['core_id'], 'installation_id': context['trial_id']}:
        raise PermissionError('inventory_installation_mismatch')
    marker = json.loads(safe(root / 'installed627.json').read_bytes())
    if marker.get('schema') != 'cp.native.installed627.v1':
        raise PermissionError('inventory_marker_invalid')
    row = marker['modules'].get(SKU)
    if row is None:
        return None
    folder = safe(row['folder'])
    if not folder.is_relative_to(root / 'libraries' / SKU):
        raise PermissionError('inventory_package_outside_library')
    manifest = json.loads(safe(folder / 'manifest.json').read_bytes())['manifest']
    if hashlib.sha256(canonical(manifest)).hexdigest() != RELEASES[SKU]:
        raise PermissionError('inventory_release_not_reviewed')
    namespace = Namespace(folder, sku=SKU, public_key=PUBLIC_KEY, state_root=root)
    try:
        namespace.guard.verify(SKU, context['trial_id'])
        return namespace, namespace.load('cp_inventory/ha.py')
    except BaseException:
        namespace.close()
        raise


async def register_installed(hass, entry, context, bridge):
    root = safe(Path(hass.config.path('.storage/cloudpelizzon_compiled627')))
    if not await hass.async_add_executor_job((root / 'installed627.json').is_file):
        return None

    try:
        verified = await hass.async_add_executor_job(_verified_package, root, context)
        if verified is None:
            return None
        namespace, adapter = verified
        try:
            inventory = await adapter.register(
                hass, entry, {**context, 'client': LocalSDK(context['trial_id'], {})}
            )
        except BaseException:
            namespace.close()
            raise
    except Exception as error:
        _LOGGER.warning('Inventory package could not be loaded (%s)', type(error).__name__)
        return None

    previous_ready = bridge.local_ready

    def ready():
        modules = previous_ready()
        return modules if inventory.closed else modules | {SKU}

    bridge.local_ready = ready
    hass.data[KEY] = namespace

    def close():
        if hass.data.get(KEY) is namespace:
            hass.data.pop(KEY)
        if bridge.local_ready is ready:
            bridge.local_ready = previous_ready
        inventory.close()
        namespace.close()

    return close
