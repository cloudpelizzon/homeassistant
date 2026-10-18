"""Use an existing Core/Portal signer locally. No enrollment or key generation."""
import os
from pathlib import Path
import stat
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey


def sign_existing(folder, message):
    try:
        folder = Path(folder).absolute()
        if folder.resolve() != folder:
            raise ValueError()
        info = folder.lstat()
        if (not stat.S_ISDIR(info.st_mode) or
                (os.name == 'posix' and (info.st_uid != os.geteuid() or info.st_mode & 0o077))):
            raise ValueError()
        path = folder/'installation_private.pem'
        before = path.lstat()
        if (not stat.S_ISREG(before.st_mode) or before.st_nlink != 1 or before.st_size > 4096
                or (os.name == 'posix' and (before.st_uid != os.geteuid() or before.st_mode & 0o077))):
            raise ValueError()
        fd = os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0))
        with os.fdopen(fd, 'rb') as stream:
            opened = os.fstat(stream.fileno())
            if (opened.st_dev, opened.st_ino, opened.st_mode, opened.st_nlink) != (
                    before.st_dev, before.st_ino, before.st_mode, before.st_nlink):
                raise ValueError()
            raw = stream.read(4097)
        if len(raw) > 4096:
            raise ValueError()
        key = serialization.load_pem_private_key(raw, password=None)
        if not isinstance(key, Ed25519PrivateKey):
            raise ValueError()
        return key.sign(message)
    except Exception:
        raise PermissionError('portal_signer_missing_or_untrusted') from None
