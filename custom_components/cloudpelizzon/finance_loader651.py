"""Public native-library loader: verify before executing any C initializer."""
import base64, hashlib, importlib, importlib.util, json, platform, re, sys, sysconfig, threading, time
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
DOMAIN = b'CP-NATIVE-PACKAGE627-V1\n'
ENTITLEMENT = b'CP-COMPILED-ENTITLEMENT627-V1\n'
ENTRIES = {'CP-FINANCE': 'cp_finance651'}
LOCK = threading.RLock()
VERIFIED_MODULES = {}

def canonical(v):
    return json.dumps(v, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()

def safe(path):
    path = Path(path).absolute()
    if any((p.is_symlink() for p in (path, *path.parents))):
        raise PermissionError('native_path_alias')
    return path

def package_folder(state_root, *, public_key):
    root = safe(state_root)
    marker = safe(root / 'installed627.json')
    if marker.exists():
        state = json.loads(marker.read_bytes())
        if state['schema'] != 'cp.native.installed627.v1':
            raise PermissionError('native_installation_marker_invalid')
        record = state['modules'].get('CP-FINANCE')
        if record is not None:
            version = record['version']
            if not re.fullmatch('[a-f0-9]{64}', version) or record['public_key'] != public_key or record['test_only'] is not False:
                raise PermissionError('finance_installation_marker_invalid')
            folder = safe(root / 'libraries' / 'CP-FINANCE' / version)
            if safe(record['folder']) != folder:
                raise PermissionError('finance_installation_folder_invalid')
            packet = json.loads(safe(folder / 'manifest.json').read_bytes())
            if hashlib.sha256(canonical(packet['manifest'])).hexdigest() != version:
                raise PermissionError('finance_installation_digest_invalid')
            return folder
    return safe(root / 'CP-FINANCE' / 'package')

class Namespace:

    def __init__(self, folder, *, sku, public_key, state_root, allow_test=False):
        self.folder = safe(folder)
        self.sku = sku
        self.closed = True
        packet = json.loads((self.folder / 'manifest.json').read_bytes())
        m = packet['manifest']
        Ed25519PublicKey.from_public_bytes(bytes.fromhex(public_key)).verify(base64.b64decode(packet['signature'], validate=True), DOMAIN + canonical(m))
        if m['schema'] != 'cp.native.package627.v1' or m['sku'] != sku or m['entry'] != ENTRIES[sku] or (m['abi'] != sysconfig.get_config_var('SOABI')) or (m['architecture'] != platform.machine()):
            raise PermissionError('native_package_compatibility')
        if m['test_only'] and (not allow_test):
            raise PermissionError('test_package_not_commercial')
        if len(m['files']) != 1:
            raise PermissionError('one_native_library_required')
        name, digest = next(iter(m['files'].items()))
        if Path(name).name != name or name != m['entry'] + '.' + m['abi'] + '.so' or (not re.fullmatch('[a-f0-9]{64}', digest)):
            raise PermissionError('native_file_name')
        binary = safe(self.folder / name)
        if binary.stat().st_size > 268435456 or hashlib.sha256(binary.read_bytes()).hexdigest() != digest:
            raise PermissionError('native_binary_integrity')
        state = safe(state_root)
        grant = json.loads((state / sku / 'license.json').read_bytes())
        Ed25519PublicKey.from_public_bytes(bytes.fromhex(public_key)).verify(base64.b64decode(grant['signature'], validate=True), ENTITLEMENT + canonical(grant['claims']))
        from .finance_access653 import validate_finance_access
        validate_finance_access(grant['claims'], int(time.time()))
        with LOCK:
            current = sys.modules.get(m['entry'])
            if current is not None:
                if not getattr(current, '__compiled__', None) or VERIFIED_MODULES.get(m['entry']) != (current, binary, digest):
                    raise PermissionError('native_restart_required')
                self.module = current
            else:
                spec = importlib.util.spec_from_file_location(m['entry'], binary)
                module = importlib.util.module_from_spec(spec)
                sys.modules[m['entry']] = module
                try:
                    spec.loader.exec_module(module)
                except BaseException:
                    sys.modules.pop(m['entry'], None)
                    raise
                if not getattr(module, '__compiled__', None):
                    raise PermissionError('native_compilation_required')
                VERIFIED_MODULES[m['entry']] = (module, binary, digest)
                self.module = module
        self.manifest = m
        self.closed = False
        self.guard = importlib.import_module('_cp_finance_guard653')
        self.guard.verify(sku)

    def load(self, path):
        if self.closed or not isinstance(path, str) or (not path.endswith('.py')) or path.startswith('/') or ('..' in Path(path).parts):
            raise PermissionError('native_namespace_closed_or_path')
        name = path[:-3].replace('/', '.')
        allowed = set(self.manifest['modules'])
        if name not in allowed:
            raise PermissionError('native_module_not_in_package')
        module = importlib.import_module(name)
        if not getattr(module, '__compiled__', None):
            raise PermissionError('plaintext_engine_rejected')
        return module

    def close(self):
        self.closed = True
