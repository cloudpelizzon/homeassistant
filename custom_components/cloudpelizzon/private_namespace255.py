"""Isolated imports for unchanged signed engines with legacy absolute imports.

Imports are redirected only inside each verified module's own builtins mapping.
Global builtins and unrelated HA modules are never patched. Data resources are
verified before import; no resource or module is taken from an unverified path.
"""
import builtins,os,sys
from pathlib import Path
if __package__:
 from .module_package243 import verify,sha
 from .private_runtime248 import PackageNamespace
 from .tenant_migration246 import safe
else:
 from module_package243 import verify,sha
 from private_runtime248 import PackageNamespace
 from tenant_migration246 import safe

class VerifiedNamespace(PackageNamespace):
 def __init__(self,packet,archive,*,sku,pin,core,operations,resources):
  manifest,files=verify(packet,archive,sku=sku,signer_sha256=pin,core_id=core,allowed_operations=operations)
  self.resources=safe(resources)
  if self.resources.exists():raise PermissionError('new_private_resource_folder_required')
  self.resources.mkdir(mode=0o700)
  self.data={name:raw for name,raw in files.items() if not name.endswith('.py')}
  for name,raw in self.data.items():
   p=safe(self.resources/name);p.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
   fd=os.open(p,os.O_CREAT|os.O_EXCL|os.O_WRONLY|getattr(os,'O_NOFOLLOW',0),0o600)
   with os.fdopen(fd,'wb') as f:f.write(raw);f.flush();os.fsync(f.fileno())
  self.roots={name.split('/')[0] if '/' in name else name[:-3] for name in files if name.endswith('.py')}
  super().__init__(files)
 def private_import(self,name,globals=None,locals=None,fromlist=(),level=0):
  if level==0 and name.split('.')[0] in self.roots:
   result=builtins.__import__(self.prefix+'.'+name,globals,locals,fromlist,0)
   return result if fromlist else sys.modules[self.prefix+'.'+name.split('.')[0]]
  return builtins.__import__(name,globals,locals,fromlist,level)
 def exec_module(self,module):
  path,package=self.source(module.__name__)
  module.__file__=str(self.resources/path)
  module.__builtins__={**builtins.__dict__,'__import__':self.private_import}
  super().exec_module(module)
 def load(self,path):
  for name,raw in self.data.items():
   p=safe(self.resources/name)
   if not p.is_file() or p.stat().st_size!=len(raw) or sha(p.read_bytes())!=sha(raw):raise PermissionError('signed_package_resource_changed')
  return super().load(path)
