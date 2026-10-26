"""Reject unreviewed files, changed hashes and sensitive server-side artifacts."""
import hashlib,json,re,subprocess,sys
from pathlib import Path,PurePosixPath
BAD_PARTS={'.storage','__pycache__','server','private','backups','modules','node_modules','.git','_paid_modules','private_lighting'}
BAD_SUFFIXES={'.pem','.key','.p12','.pfx','.db','.sqlite','.sqlite3','.pyc','.pyo','.bak','.zip','.tar','.gz','.whl'}
BAD_NAMES={'.env','secrets.yaml','credentials.json','id_rsa','id_ed25519','security_engine.py','server_r2.py','pilot_authority.py','trust.json','authority-public.json','release-signing-input.bin'}
PATTERNS=(re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
    re.compile(rb'(?:gh[pousr]_[A-Za-z0-9_]{30,}|github_pat_[A-Za-z0-9_]{20,})'),
    re.compile(rb'(?:AKIA[0-9A-Z]{16}|sk-(?:proj-)?[A-Za-z0-9_-]{30,})'))
def verify(root,names):
    doc=json.loads((root/'source-manifest.json').read_text(encoding='utf-8'))
    expected=doc.get('files')
    if not isinstance(expected,dict) or not expected:return ['empty_source_inventory']
    issues=[]
    if set(names)!=set(expected)|{'source-manifest.json'}:issues.append('unreviewed_or_missing_files')
    for name in names:
        path=PurePosixPath(name);target=root/name
        if (path.is_absolute() or '..' in path.parts or '\\' in name or not path.parts
            or any(part.lower() in BAD_PARTS for part in path.parts)
            or path.suffix.lower() in BAD_SUFFIXES or path.name.lower() in BAD_NAMES):
            issues.append(name+': forbidden_path');continue
        if target.is_symlink() or not target.is_file() or not target.resolve().is_relative_to(root.resolve()):
            issues.append(name+': invalid_file');continue
        raw=target.read_bytes()
        if any(p.search(raw) for p in PATTERNS):issues.append(name+': potential_secret')
        if name!='source-manifest.json' and expected.get(name)!=hashlib.sha256(raw).hexdigest():
            issues.append(name+': unreviewed_hash')
    return issues
def main():
    root=Path(__file__).resolve().parents[1]
    result=subprocess.run(['git','-C',str(root),'ls-files','-z'],capture_output=True,check=True)
    names=[name.decode('utf-8') for name in result.stdout.split(b'\0') if name]
    issues=verify(root,names)
    print('PUBLIC_SOURCE_CHECK='+('BLOCKED' if issues else 'PASS'))
    for issue in issues:print(issue)
    return 1 if issues else 0
if __name__=='__main__':sys.exit(main())
