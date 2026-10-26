"""Commercial contact scope follows the installed shared module registry.

Membership permits requesting information only; native purchase, signature,
licensing, Trial and installation checks remain independent.
"""
from pathlib import Path
from .module_registry294 import Registry
from .module_profile298 import REGISTRY_SHA
from .module_package243 import sha
from .tenant_migration246 import safe
def request_skus():
 path=safe(Path(__file__).with_name('module_registry294.json'))
 if sha(path.read_bytes())!=REGISTRY_SHA:raise PermissionError('reviewed_module_registry_required')
 return frozenset(spec.sku for spec in Registry.load(path).modules())
SKUS=request_skus()
