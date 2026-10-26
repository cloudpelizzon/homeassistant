"""Declarative module catalog and shared flow routing. It never grants rights.

Descriptors are configuration, not executable code, authorization or readiness.
Trusted native backends validate signatures, acceptance, payment and enrollment.
The registry cannot replace those checks or enable a missing engine adapter.
"""
from dataclasses import asdict,dataclass
import json,re
from pathlib import Path

COMMON_FIELDS={'trial_profile','pricing','proposal','email','online_terms','licensing','delivery','installer','portal'}
def need(ok,code):
 if not ok:raise ValueError(code)
@dataclass(frozen=True)
class ModuleSpec:
 sku:str
 label:str
 currency:str
 price_cents:int
 price_source:str
 read_operation:str|None
 runtime_adapter:str|None
 migration_adapter:str|None
 release_manifest_sha256:str|None
 source_status:str
 def __post_init__(self):
  need(type(self.sku) is str and re.fullmatch(r'CP-[A-Z0-9-]{2,80}',self.sku),'module_sku_required')
  need(type(self.label) is str and 0<len(self.label)<=160 and self.label.isprintable(),'module_label_required')
  need(self.currency=='BRL' and type(self.price_cents) is int and 0<self.price_cents<=100000000,'module_price_required')
  need(self.price_source in ('catalog_reference_requires_live_readback','operator_approved','native_audit284','proposed'),'module_price_provenance_required')
  need(self.source_status in ('planned','signed_candidate','legacy_deployed'),'module_source_status_required')
  need(self.read_operation is None or type(self.read_operation) is str and re.fullmatch(r'[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){1,8}',self.read_operation),'module_read_scope_required')
  for name in (self.runtime_adapter,self.migration_adapter):need(name is None or type(name) is str and re.fullmatch('[a-z][a-z0-9_]{1,79}',name),'installed_adapter_identifier_required')
  need(self.release_manifest_sha256 is None or type(self.release_manifest_sha256) is str and re.fullmatch('[a-f0-9]{64}',self.release_manifest_sha256),'module_release_digest_required')

class Registry:
 def __init__(self,document):
  need(type(document) is dict and set(document)=={'schema','common','modules'},'module_registry_fields_required')
  need(document['schema']=='cp.module.registry294.v1' and type(document['common']) is dict and set(document['common'])==COMMON_FIELDS,'shared_module_policy_required')
  need(all(type(v) is str and re.fullmatch('[a-z0-9_.-]{1,100}',v) for v in document['common'].values()),'shared_policy_reference_required')
  need(type(document['modules']) is list and 0<len(document['modules'])<=200,'bounded_module_catalog_required')
  self._common=dict(document['common']);self._modules={}
  for row in document['modules']:
   need(type(row) is dict,'module_descriptor_required')
   spec=ModuleSpec(**row);need(spec.sku not in self._modules,'duplicate_module_sku');self._modules[spec.sku]=spec
 @classmethod
 def load(cls,path):return cls(json.loads(Path(path).read_bytes()))
 def get(self,sku):
  need(type(sku) is str and sku in self._modules,'registered_module_required');return self._modules[sku]
 def common(self):return dict(self._common)
 def document(self):return {'schema':'cp.module.registry294.v1','common':self.common(),'modules':[asdict(m) for m in self._modules.values()]}
 def modules(self):return tuple(self._modules.values())

class SharedFlow:
 """One routing API; native backends and approved engine factories are injected.

 Backends implement trial.activate, commerce.request_offer/accept_proposal,
 installer.install/status and portal.access. These operations retain their
 existing native authority; merely adding a descriptor never makes them pass.
 """
 def __init__(self,registry,*,backends,engine_adapters):
  self.registry=registry;self.backends=dict(backends);self.engine_adapters=dict(engine_adapters)
 def backend(self,name):
  need(name in self.backends,'native_backend_not_connected_'+name);return self.backends[name]
 def module(self,sku):return self.registry.get(sku)
 def activate_trial(self,sku,*,confirmed,**native_context):
  need(confirmed is True,'explicit_trial_choice_required')
  spec=self.module(sku)
  return self.backend('trial').activate(spec=spec,profile=self.registry.common()['trial_profile'],confirmed=True,**native_context)
 def request_offer(self,sku,**native_context):
  spec=self.module(sku)
  return self.backend('commerce').request_offer(spec=spec,policies=self.registry.common(),**native_context)
 def accept_proposal(self,sku,**native_context):
  # Neither payment choice nor a chat reply substitutes for native acceptance.
  return self.backend('commerce').accept_proposal(spec=self.module(sku),**native_context)
 def install(self,sku,*,confirmed,**native_context):
  need(confirmed is True,'explicit_installation_choice_required');spec=self.module(sku)
  need(spec.runtime_adapter in self.engine_adapters,'module_engine_adapter_not_connected')
  need(spec.read_operation is not None and spec.migration_adapter is not None,'module_install_contract_not_configured')
  return self.backend('installer').install(spec=spec,engine_adapter=self.engine_adapters[spec.runtime_adapter],confirmed=True,**native_context)
 def installation_status(self,sku,**native_context):return self.backend('installer').status(spec=self.module(sku),**native_context)
 def portal_access(self,sku,**native_context):return self.backend('portal').access(spec=self.module(sku),**native_context)
