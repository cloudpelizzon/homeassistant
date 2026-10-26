"""Admin read-only probe using native signed authorization and the real HA session."""
import asyncio,re,secrets
from pathlib import Path

def failure(stage,exc):
 allowed={'lighting_unavailable','lighting_result_denied','lighting_result_binding','lighting_result_expired','status_not_verified','transport_failed','authority_unavailable','capability_invalid','licensed_module_requires_local_installation','lighting_denied_or_unavailable','lighting_read_unavailable'}
 text=str(exc)
 code=text if text in allowed or re.fullmatch('request_denied_http_[0-9]{3}',text) else type(exc).__name__
 frames=[];tb=exc.__traceback__
 while tb is not None:
  frames.append({'file':Path(tb.tb_frame.f_code.co_filename).name,'function':tb.tb_frame.f_code.co_name,'line':tb.tb_lineno});tb=tb.tb_next
 return {'stage':stage,'ok':False,'code':code,'frames':frames[-6:]}

async def diagnose(hass,connection):
 user=getattr(connection,'user',None)
 if user is None or not user.is_active or not user.is_admin or getattr(user,'system_generated',False):raise PermissionError('admin_required')
 report={'schema':'cp.lighting.read.diagnostic235.v1','checks':[],'trials_altered':False,'licenses_altered':False,'device_commands':0,'credentials_displayed':False}
 stage='native_transport'
 try:
  transport=hass.data.get('cloudpelizzon_lighting_native_v1')
  if transport is None:raise RuntimeError('native_transport_absent')
  port=transport.port
  if transport.closed or port.registration_ready() is not True:raise RuntimeError('native_transport_not_ready')
  report['checks'].append({'stage':stage,'ok':True})
  stage='native_session'
  await transport._current(connection,user)
  report['checks'].append({'stage':stage,'ok':True})
  stage='signed_lifecycle'
  claim=await hass.async_add_executor_job(port.verified_status)
  row=claim['modules'].get('CP-LIGHTING',{})
  report['checks'].append({'stage':stage,'ok':True,'phase':row.get('phase'),'blocks_at':row.get('blocks_at'),'removal_due_at':row.get('removal_due_at')})
  stage='signed_grant'
  await hass.async_add_executor_job(port._grant,port.installation_id(),user.id,'lighting.config.read')
  report['checks'].append({'stage':stage,'ok':True})
  stage='signed_configuration_read'
  page=await hass.async_add_executor_job(port._execute,port.installation_id(),user.id,'lighting.config.read',{'actor_id':user.id,'parameters':{'offset':0,'limit':100}},secrets.token_hex(16))
  report['checks'].append({'stage':stage,'ok':True})
  stage='native_page_contract'
  from .public_lighting.native_scope import _validated_page
  _validated_page(page,0,None)
  report['checks'].append({'stage':stage,'ok':True})
  stage='native_snapshot'
  await transport.run(connection,{'type':'cloudpelizzon/lighting/v1/snapshot','id':1})
  report['checks'].append({'stage':stage,'ok':True})
 except asyncio.CancelledError:raise
 except Exception as exc:report['checks'].append(failure(stage,exc))
 current=await hass.auth.async_get_user(user.id)
 if connection.user is not user or getattr(connection,'closed',False) is True or current is None or not current.is_active or not current.is_admin:raise PermissionError('diagnostic_session_changed')
 report['ok']=bool(report['checks']) and all(c['ok'] for c in report['checks'])
 return report
