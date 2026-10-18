"""Local installation keys only; no trial, license or authority approval."""
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import threading

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

_LOCK = threading.Lock()


def _directory(path):
    path = Path(path).absolute()
    if path.resolve() != path:
        raise ValueError('identity_directory_alias')
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    info = path.lstat()
    if (not stat.S_ISDIR(info.st_mode) or
            os.name == 'posix' and (info.st_uid != os.geteuid() or info.st_mode & 0o077)):
        raise ValueError('identity_directory_permissions')
    return path


def _read(path, limit):
    before = path.lstat()
    if (not stat.S_ISREG(before.st_mode) or before.st_nlink != 1 or before.st_size > limit
            or os.name == 'posix' and (before.st_uid != os.geteuid() or before.st_mode & 0o077)):
        raise ValueError('identity_file_permissions')
    fd = os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0))
    with os.fdopen(fd, 'rb') as stream:
        opened = os.fstat(stream.fileno())
        if (opened.st_dev, opened.st_ino, opened.st_mode, opened.st_nlink) != (
                before.st_dev, before.st_ino, before.st_mode, before.st_nlink):
            raise ValueError('identity_file_changed')
        value = stream.read(limit + 1)
    if len(value) > limit:
        raise ValueError('identity_file_size')
    return value


def _write_new(path, raw):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, 'O_NOFOLLOW', 0), 0o600)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())


def _key(path):
    # A broken, missing or changed existing key must never be silently rotated.
    if not path.exists() and not path.is_symlink():
        key = Ed25519PrivateKey.generate()
        _write_new(path, key.private_bytes(serialization.Encoding.PEM,
                    serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    raw = _read(path, 4096)
    key = serialization.load_pem_private_key(raw, password=None)
    if not isinstance(key, Ed25519PrivateKey):
        raise ValueError('identity_key_type')
    return key


def _public(key):
    return key.public_key().public_bytes(serialization.Encoding.Raw,
                                         serialization.PublicFormat.Raw)


def provision(root):
    """Called after explicit setup consent; return public data, never key bytes."""
    with _LOCK:
        root = Path(root).absolute()
        if root.resolve() != root or not root.is_dir():
            raise ValueError('HA_directory_required')
        edge = _directory(root / '.storage/cloudpelizzon_edge')
        meta_path = edge / 'identity.json'
        key_path = edge / 'installation.pem'
        if (meta_path.exists() or meta_path.is_symlink()) and not key_path.exists():
            raise ValueError('existing_identity_key_missing')
        trial = _key(key_path)
        public = _public(trial)
        if meta_path.exists() or meta_path.is_symlink():
            def unique(pairs):
                value = {}
                for name, item in pairs:
                    if name in value:
                        raise ValueError('duplicate_identity_field')
                    value[name] = item
                return value
            meta = json.loads(_read(meta_path, 2048), object_pairs_hook=unique)
            if (type(meta) is not dict or set(meta) != {'schema', 'installation_id', 'public_key_hex'}
                    or meta['schema'] != 'cp.ha.identity.v1'
                    or type(meta['installation_id']) is not str
                    or not re.fullmatch('[A-Za-z0-9_-]{8,160}', meta['installation_id'])
                    or meta['public_key_hex'] != public.hex()):
                raise ValueError('existing_identity_invalid')
        else:
            # Derivation makes recovery after a crash between key/meta writes
            # reuse the same identity. This is not server enrollment or a grant.
            meta = {'schema': 'cp.ha.identity.v1',
                    'installation_id': 'cp-ha-' + hashlib.sha256(public).hexdigest(),
                    'public_key_hex': public.hex()}
            _write_new(meta_path, (json.dumps(meta, sort_keys=True) + '\n').encode())
        portal_dir = _directory(root / '.cp-trial-phase2-enrollment')
        portal = _key(portal_dir / 'installation_private.pem')
        if _public(portal) == public:
            raise ValueError('separate_identity_keys_required')
        return {'trial_id': meta['installation_id'],
                'trial_public_key_hex': public.hex(),
                'portal_public_key_hex': _public(portal).hex()}
