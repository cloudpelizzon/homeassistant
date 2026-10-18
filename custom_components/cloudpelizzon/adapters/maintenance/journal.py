import json,os,stat,uuid
READINESS='maintenance_runtime56.json'
def receipt(folder,data):
    if folder.resolve()!=folder.absolute() or folder.stat().st_uid!=os.geteuid() or folder.stat().st_mode&0o077:raise ValueError('identity_folder_untrusted')
    path=folder/READINESS
    if path.exists():
        info=path.lstat()
        if not stat.S_ISREG(info.st_mode) or info.st_nlink!=1 or info.st_uid!=os.geteuid() or info.st_mode&0o077:raise ValueError('readiness_file_untrusted')
    temp=folder/('.solar45-'+uuid.uuid4().hex)
    fd=os.open(temp,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    try:
        os.fchmod(fd,0o600)
        with os.fdopen(fd,'wb') as stream:stream.write(json.dumps(data,sort_keys=True).encode());stream.flush();os.fsync(stream.fileno())
        os.replace(temp,path)
    finally:temp.unlink(missing_ok=True)
