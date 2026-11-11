"""Build the reviewed HACS archive and enforce a margin below Marketplace's limit."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
COMPONENT = ROOT / 'custom_components' / 'cloudpelizzon'
MARKETPLACE_LIMIT = 100 * 1024 * 1024
PACKAGE_BUDGET = 90 * 1024 * 1024
EXTRACTED_BUDGET = 99 * 1024 * 1024

VERSION_PATTERN = '(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(?:-((?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\\+([0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*))?'

def build(output):
    version = json.loads((COMPONENT / 'manifest.json').read_text(encoding='utf-8'))['version']
    if not isinstance(version, str) or not re.fullmatch(VERSION_PATTERN, version):
        raise ValueError('Version must use SemVer (MAJOR.MINOR.PATCH)')
    names = subprocess.check_output(
        ['git', 'ls-files', '-z', 'custom_components/cloudpelizzon'], cwd=ROOT
    ).decode().split('\0')
    names = sorted(name for name in names if name)
    output = Path(output).resolve()
    if output.is_relative_to(COMPONENT):
        raise ValueError('Archive must be outside the integration')
    output.parent.mkdir(parents=True, exist_ok=True)
    extracted_size = sum((ROOT / name).stat().st_size for name in names)
    if extracted_size > EXTRACTED_BUDGET:
        raise ValueError(
            f'Extracted package {extracted_size} bytes exceeds release budget '
            f'{EXTRACTED_BUDGET}; Marketplace limit {MARKETPLACE_LIMIT}'
        )
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name in names:
            path = ROOT / name
            relative = path.relative_to(COMPONENT).as_posix()
            if path.suffix in ('.so', '.pyd', '.dll', '.db', '.key', '.pem'):
                raise ValueError('Private or executable artifact: ' + relative)
            info = zipfile.ZipInfo(relative, date_time=(2026, 11, 6, 12, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, path.read_bytes())
    with zipfile.ZipFile(output) as archive:
        assert archive.testzip() is None
        assert sum(member.file_size for member in archive.infolist()) == extracted_size
        assert len(archive.namelist()) == len(names)
        assert json.loads(archive.read('manifest.json'))['version'] == version
        for name in names:
            assert archive.read((ROOT / name).relative_to(COMPONENT).as_posix()) == (ROOT / name).read_bytes()
    size = output.stat().st_size
    if size > PACKAGE_BUDGET:
        raise ValueError(f'Package {size} bytes exceeds release budget {PACKAGE_BUDGET}; Marketplace limit {MARKETPLACE_LIMIT}')
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    output.with_name('SHA256SUMS').write_text(digest + '  ' + output.name + '\n', encoding='ascii')
    return {'version': version, 'files': len(names), 'size': size, 'sha256': digest,
            'marketplace_limit': MARKETPLACE_LIMIT, 'release_budget': PACKAGE_BUDGET,
            'extracted_size': extracted_size, 'extracted_budget': EXTRACTED_BUDGET}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True)
    print(json.dumps(build(parser.parse_args().output)))
