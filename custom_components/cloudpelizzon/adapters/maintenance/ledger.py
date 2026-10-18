import os,stat
from pathlib import Path
def secure_db(path):
    path=Path(path).absolute()
    if path.resolve()!=path:raise ValueError('database_alias')
    parent=path.parent.stat()
    if os.name=='posix' and (parent.st_uid!=os.geteuid() or parent.st_mode&0o022):raise ValueError('database_parent_untrusted')
    try:
        fd=os.open(path,os.O_CREAT|os.O_EXCL|os.O_WRONLY|getattr(os,'O_NOFOLLOW',0),0o600);os.close(fd)
    except FileExistsError:pass
    info=path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_nlink!=1:raise ValueError('database_type')
    if os.name=='posix' and (info.st_uid!=os.geteuid() or info.st_mode&0o077):raise ValueError('database_permissions')
    return str(path)
