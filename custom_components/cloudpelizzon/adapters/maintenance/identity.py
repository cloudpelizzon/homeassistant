"""Read only a provisioned local identity; never enroll or export private keys."""
import json,os,re,stat
from pathlib import Path
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

class IdentityError(Exception):pass

def unique(pairs):
    result={}
    for key,value in pairs:
        if key in result:raise IdentityError('identity_invalid')
        result[key]=value
    return result

def load_identity(folder):
    try:
        folder=Path(folder).absolute()
        if folder.resolve()!=folder:raise ValueError()
        info=folder.lstat()
        if not stat.S_ISDIR(info.st_mode) or (os.name=='posix' and (info.st_uid!=os.geteuid() or info.st_mode&0o077)):raise ValueError()
        values={}
        for name,limit in (('identity.json',2048),('installation.pem',4096)):
            path=folder/name;info=path.lstat()
            if (not stat.S_ISREG(info.st_mode) or info.st_nlink!=1 or info.st_size>limit
                or (os.name=='posix' and (info.st_uid!=os.geteuid() or info.st_mode&0o077))):raise ValueError()
            fd=os.open(path,os.O_RDONLY|getattr(os,'O_NOFOLLOW',0))
            with os.fdopen(fd,'rb') as stream:
                opened=os.fstat(stream.fileno())
                if (opened.st_dev,opened.st_ino)!=(info.st_dev,info.st_ino):raise ValueError()
                values[name]=stream.read(limit+1)
                if len(values[name])>limit:raise ValueError()
        meta=json.loads(values['identity.json'],object_pairs_hook=unique)
        if (not isinstance(meta,dict) or set(meta)!={'schema','installation_id','public_key_hex'} or meta['schema']!='cp.ha.identity.v1'
            or not isinstance(meta['installation_id'],str) or not re.fullmatch('[A-Za-z0-9_-]{8,160}',meta['installation_id'])):raise ValueError()
        key=serialization.load_pem_private_key(values['installation.pem'],password=None)
        if not isinstance(key,Ed25519PrivateKey):raise ValueError()
        public=key.public_key().public_bytes(serialization.Encoding.Raw,serialization.PublicFormat.Raw).hex()
        if meta['public_key_hex']!=public:raise ValueError()
        return meta['installation_id'],key
    except Exception:raise IdentityError('identity_missing_or_untrusted') from None
