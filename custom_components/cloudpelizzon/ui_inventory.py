"""Verify a closed public asset tree before handing it to HA's static server."""
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import stat

ROUTES = {
    '/cloudpelizzon/frontend': 'ui/shell',
    '/cloudpelizzon-core/frontend': 'ui/core',
    '/cloudpelizzon-updater/frontend': 'ui/updater',
    '/cloudpelizzon-solar/frontend': 'ui/solar',
    '/cloudpelizzon-energy/frontend': 'ui/solar',
    '/cloudpelizzon-maintenance/frontend': 'ui/maintenance',
    '/cloudpelizzon-security/frontend': 'ui/security',
    '/cloudpelizzon-automation/frontend': 'ui/automation',
}
SUFFIXES = {'.js', '.css', '.html', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.ico', '.woff', '.woff2', '.ttf'}


def unique(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('duplicate_manifest_key')
        result[key] = value
    return result


def regular(path, limit):
    info = path.lstat()
    if (not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_size > limit
            or (os.name == 'posix' and info.st_mode & 0o022)):
        raise ValueError('untrusted_public_asset')
    with path.open('rb') as stream:
        opened = os.fstat(stream.fileno())
        if (opened.st_dev, opened.st_ino) != (info.st_dev, info.st_ino):
            raise ValueError('asset_changed_during_open')
        data = stream.read(limit+1)
    if len(data) > limit:
        raise ValueError('public_asset_size')
    return data


def directory(path):
    info = path.lstat()
    if not stat.S_ISDIR(info.st_mode) or (os.name == 'posix' and info.st_mode & 0o022):
        raise ValueError('untrusted_public_directory')


def verify(root):
    root = Path(root).absolute()
    if root.resolve() != root:
        raise ValueError('public_root_alias')
    directory(root)
    raw = regular(root/'ui_inventory.json', 256*1024)
    document = json.loads(raw, object_pairs_hook=unique)
    if type(document) is not dict or set(document) != {'schema', 'files'} or document['schema'] != 'cp.ui.inventory73.v1':
        raise ValueError('invalid_public_inventory')
    expected = document['files']
    if type(expected) is not dict or not 7 <= len(expected) <= 256:
        raise ValueError('invalid_public_inventory_size')
    seen = set()
    sections = set()
    for name, digest in expected.items():
        path = PurePosixPath(name)
        if (type(name) is not str or '\\' in name or ':' in name or path.is_absolute()
                or any(part in ('', '.', '..') for part in name.split('/'))
                or len(path.parts) < 3 or '/'.join(path.parts[:2]) not in ROUTES.values()
                or path.suffix.lower() not in SUFFIXES or name.casefold() in seen
                or type(digest) is not str or len(digest) != 64 or any(c not in '0123456789abcdef' for c in digest)):
            raise ValueError('unsafe_public_asset_name')
        seen.add(name.casefold())
        sections.add('/'.join(path.parts[:2]))
    if sections != set(ROUTES.values()):
        raise ValueError('public_UI_section_missing')
    actual = set()
    total = 0
    ui = root/'ui'
    if ui.is_symlink() or not ui.is_dir():
        raise ValueError('public_UI_root_required')
    for folder, dirs, names in os.walk(ui, followlinks=False):
        directory(Path(folder))
        for name in dirs:
            if (Path(folder)/name).is_symlink():
                raise ValueError('public_asset_directory_alias')
        for name in names:
            asset = Path(folder)/name
            relative = asset.relative_to(root).as_posix()
            if relative not in expected:
                raise ValueError('unexpected_public_file')
            data = regular(asset, 8*1024*1024)
            total += len(data)
            if total > 96*1024*1024 or hashlib.sha256(data).hexdigest() != expected[relative]:
                raise ValueError('public_asset_integrity')
            actual.add(relative)
    if actual != set(expected):
        raise ValueError('public_asset_missing')
    fingerprint = hashlib.sha256(json.dumps(expected, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    return {'root': str(root), 'inventory_sha256': fingerprint, 'files': len(actual)}
