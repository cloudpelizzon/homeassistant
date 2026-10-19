"""Owned Security management, signed state transport and physical relay."""
from collections.abc import Mapping
from functools import partial
from .adapters.security.configuration import api as configuration
from .adapters.security.engines import api as engines
from .adapters.security.engines.bridge import EngineBridge
from .public_security.runtime126 import create as create_edge
from .public_security import api126

async def create(hass,entry,context):
 delivery=entry.options.get('security_delivery',{})
 if (not isinstance(delivery,Mapping) or delivery.get('enabled',False) is not False
  or entry.options.get('security_shadow_control',False) is not False):raise ValueError('security_delivery_requires_separate_acceptance')
 client=context['client'];closes=[]
 class ConfigurationClient:
  def execute(self,sku,operation,args,*,request_id):
   actions={'security.config.read':'config.read','security.config.write':'config.write'}
   if sku!='CP-SECURITY' or operation not in actions:raise PermissionError('security_action_unavailable')
   return client.security(actions[operation],args,request_id=request_id)
 async def engine_request(operation,args,rid):
  actions={'security.engines.read':'engines.read','security.engines.update':'engines.update'}
  if operation not in actions:raise PermissionError('engine_action_unavailable')
  return await hass.async_add_executor_job(partial(client.security,actions[operation],args,request_id=rid))
 try:
  edge=create_edge(hass,entry,context);context['security_edge']=edge;closes.append(edge.close)
  closes.append(api126.register(hass,edge))
  closes.append(configuration.register(hass,ConfigurationClient(),shadow_control=False))
  bridge=EngineBridge(engine_request);closes.append(bridge.close);closes.append(engines.register(hass,bridge))
 except BaseException:
  for close in reversed(closes):close()
  raise
 closed=False
 def close():
  nonlocal closed
  if closed:return
  closed=True
  for callback in reversed(closes):callback()
 return close
