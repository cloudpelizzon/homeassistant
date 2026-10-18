"""Administrator diagnostics: public installation identity, no private files."""
import hashlib
import json
from pathlib import Path
import re
import stat


def public_identity(root):
    root = Path(root).absolute()
    folder = root / '.storage/cloudpelizzon_edge'
    path = folder / 'identity.json'
    # Read only this public JSON, never installation.pem, Core secrets or entry data.
    if root.resolve() != root or folder.resolve() != folder or path.is_symlink():
        raise ValueError('public_identity_path_invalid')
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_size > 2048:
        raise ValueError('public_identity_file_invalid')
    with path.open('rb') as stream:
        raw = stream.read(2049)
    if len(raw) > 2048:
        raise ValueError('public_identity_size')
    meta = json.loads(raw)
    if (type(meta) is not dict or set(meta) != {'schema', 'installation_id', 'public_key_hex'}
            or meta['schema'] != 'cp.ha.identity.v1'
            or type(meta['installation_id']) is not str
            or not re.fullmatch('[A-Za-z0-9_-]{8,160}', meta['installation_id'])
            or type(meta['public_key_hex']) is not str
            or not re.fullmatch('[a-f0-9]{64}', meta['public_key_hex'])):
        raise ValueError('public_identity_shape_invalid')
    return {'installation_id': meta['installation_id'], 'public_key_hex': meta['public_key_hex'],
            'public_key_sha256': hashlib.sha256(bytes.fromhex(meta['public_key_hex'])).hexdigest()}


async def async_get_config_entry_diagnostics(hass, entry):
    from homeassistant.loader import async_get_integration
    result = {'schema': 'cp.public.installation.diagnostics96.v1',
              'private_keys_read': False, 'private_keys_exported': False,
              'trials_activated': False, 'device_commands': 0}
    integration = await async_get_integration(hass, 'cloudpelizzon')
    result['client_version'] = integration.version
    try:
        result['trial_identity'] = await hass.async_add_executor_job(
            public_identity, Path(hass.config.path()))
    except Exception as error:
        result['identity_error_type'] = type(error).__name__
    state = hass.data.get('cloudpelizzon')
    core = state.get('core', {}) if isinstance(state, dict) else {}
    bridge = core.get('status_transport')
    if bridge is not None:
        result['core_installation_id'] = bridge.core_id
        try:
            status = await bridge.handle('cloudpelizzon/core/status', active=True)
            result['signed_status_verified'] = status.get('status_verified') is not False
            # Public code is already filtered by the Core bridge.
            if status.get('status_verified') is False:
                result['access_error'] = status['access_error']
        except Exception as error:
            result['probe_error_type'] = type(error).__name__
    return result
