"""Native HA UI installation coordinator. Only the Solar private package is published."""
import asyncio,functools,json,os,re,time,uuid
from pathlib import Path
import probatio
from homeassistant.components import websocket_api
from . import ha_private212 as loader
from .private_protocol216 import paid_check,migrate,canonical
KEY='cloudpelizzon_private_modules216'
STATUS='cloudpelizzon/private_modules/status';INSTALL='cloudpelizzon/private_modules/install'
async def completed(future):
    # A cancelled HA request must not leave a data-writing worker running while
    # the coordinator rolls back or resumes the old controller.
    task=asyncio.ensure_future(future)
    try:return await asyncio.shield(task)
    except asyncio.CancelledError:
        try:await asyncio.shield(task)
        finally:raise
def write_private(path,value):
    temp=path.with_name('.'+path.name+'-'+uuid.uuid4().hex)
    fd=os.open(temp,os.O_CREAT|os.O_EXCL|os.O_WRONLY|os.O_NOFOLLOW,0o600)
    try:
        with os.fdopen(fd,'wb') as f:f.write(canonical(value));f.flush();os.fsync(f.fileno())
        temp.replace(path)
    finally:temp.unlink(missing_ok=True)
class Installer:
    def __init__(self,hass,entry,context):
        self.hass=hass;self.entry=entry;self.context=context;self.closed=False;self.lock=asyncio.Lock();self.progress=None
    async def job(self,fn,*args):return await completed(self.hass.async_add_executor_job(fn,*args))
    def folder(self):return Path(self.hass.config.path()).resolve()/'.storage/cloudpelizzon_paid212'
    def controller(self):
        return self.hass.data.get('cloudpelizzon',{}).get('energy',{}).get('remote_controller')
    def guard(self,connection):
        user=connection.user
        if self.closed or self.hass.data.get(KEY) is not self or user is None or user.is_active is not True or user.is_admin is not True:
            raise PermissionError('active_administrator_required')
    def update(self,step,done=0,total=0):self.progress={'step':step,'bytes_done':done,'bytes_total':total}
    async def status(self,sku,connection):
        self.guard(connection)
        if sku!='CP-SOLAR':return {'mode':'unavailable','can_install':False,'message':'O pacote local deste módulo ainda não foi publicado.'}
        if self.lock.locked():return {'mode':'installing','can_install':False,'message':(self.progress or {}).get('step','Instalação em andamento')}
        try:await self.job(paid_check,self.context['client'])
        except Exception:return {'mode':'unavailable','can_install':False,'message':'Não foi possível confirmar uma licença comercial vigente para esta instalação.'}
        self.guard(connection)
        controller=self.controller()
        if controller is None or controller.closed:return {'mode':'unavailable','can_install':False,'message':'Aguarde o carregamento do módulo no HA.'}
        installed=await loader.async_prepare(self.hass)
        self.guard(connection)
        if installed:return {'mode':'local','can_install':False,'message':'Módulo completo instalado e vinculado a este HA.'}
        return {'mode':'remote','can_install':True,'message':'Instalação local disponível, com preservação dos dados.'}
    async def install(self,sku,connection,confirmed):
        self.guard(connection)
        if sku!='CP-SOLAR' or confirmed is not True:raise PermissionError('published_package_and_explicit_choice_required')
        if self.lock.locked():raise PermissionError('installation_already_in_progress')
        async with self.lock:
            guard=lambda:self.guard(connection)
            controller=self.controller()
            if controller is None or controller.closed:raise PermissionError('solar_runtime_required')
            if await loader.async_prepare(self.hass):
                await self.job(paid_check,self.context['client']);guard()
                return {'installed':True,'engine_mode':'local','restart_required':False,'reused':True}
            self.update('Conferindo licença e pacote')
            await self.job(paid_check,self.context['client']);guard()
            root=Path(__file__).resolve().parent
            await self.job(loader.ensure,self.context['client'],self.context['core_id'],root);guard()
            folder=self.folder()
            def prepare_folder():
                folder.mkdir(mode=0o700,exist_ok=True)
                if any(v.is_symlink() for v in (folder,*folder.parents)):raise PermissionError('private_state_symlink')
                # Keep any previous unsuccessful local attempt as a private backup.
                db=folder/'solar.sqlite3'
                if db.exists():
                    if db.is_symlink():raise PermissionError('private_database_symlink')
                    db.rename(folder/('before-retry-'+uuid.uuid4().hex+'.sqlite3'))
            await self.job(prepare_folder);guard()
            bridge=controller.bridge;old_execute=bridge._execute;old_second=controller.last_second;candidate=None;activated=False;failure='installation_not_committed'
            try:
                self.update('Preservando configuração e histórico')
                async with controller.install_gate216.pause():
                    guard()
                    receipt=await self.job(migrate,self.context,folder,guard,self.update);guard()
                    self.update('Validando o motor dentro do HA')
                    def create_local():
                        loader.checked(root/'_paid_modules/solar',self.context['core_id'],self.context['trial_id'])
                        loader.installed_database(folder,self.context['core_id'],self.context['trial_id'])
                        from ._paid_modules.solar.local import LocalExecutor
                        return LocalExecutor(self.context['client'],folder/'solar.sqlite3')
                    candidate=await self.job(create_local)
                    async def execute(operation,args,request_id):
                        return await self.job(candidate.execute,operation,args,request_id)
                    # Use only the existing explicit HA sensor allowlist. No device command.
                    test_args={'states':bridge._snapshot(),'observed_at':int(time.time())}
                    result=await execute('solar.sensors.evaluate',test_args,uuid.uuid4().hex);guard()
                    if not isinstance(result,dict) or not isinstance(result.get('entities'),list):raise PermissionError('native_local_entity_projection_required')
                    await self.job(paid_check,self.context['client']);guard()
                    marker={'core_id':self.context['core_id'],'signed_id':self.context['trial_id'],'migration_verified':True,
                        'manifest_sha256':loader.MANIFEST_SHA256,'counts':receipt['counts'],
                        'native_local_operation_verified':True,'installed_at':int(time.time())}
                    await self.job(write_private,folder/'committed.json',marker);guard()
                    bridge._execute=execute;bridge._local_close216=candidate.close;bridge._local216=True
                    self.hass.data[loader.READY_KEY]={'core_id':self.context['core_id'],'signed_id':self.context['trial_id'],
                        'executor_type':type(candidate),'folder':folder}
                    controller.mirror.invalidate()
                    controller.last_second=test_args['observed_at']
                    # Exercise the original native mirror/entity pipeline before committing the UI success.
                    await controller.refresh();guard()
                    await self.job(write_private,folder/'functional216.json',{
                        'sku':'CP-SOLAR','engine_mode':'local','signed_package_verified':True,
                        'migration_counts':receipt['counts'],'native_local_operation':'solar.sensors.evaluate',
                        'native_HA_mirror_valid':controller.mirror.valid(),'entity_count':len(controller.mirror.entities),
                        'device_commands':0,'verified_at':int(time.time())})
                    activated=True
                self.update('Módulo completo instalado neste HA')
                return {'installed':True,'engine_mode':'local','restart_required':False,'data_preserved':True,
                    'native_local_operation_verified':True,'entity_count':len(controller.mirror.entities)}
            except BaseException as error:
                failure=str(error) if re.fullmatch('[A-Za-z0-9_]{1,100}',str(error)) else type(error).__name__
                raise
            finally:
                if not activated:
                    bridge._execute=old_execute;bridge._local216=False
                    controller.last_second=old_second
                    self.hass.data.pop(loader.READY_KEY,None)
                    bridge._local_close216=None
                    if candidate:candidate.close()
                    controller.mirror.invalidate()
                    def rollback_marker():
                        marker=folder/'committed.json'
                        if marker.exists():marker.rename(folder/('failed-activation-'+uuid.uuid4().hex+'.json'))
                    await self.job(rollback_marker)
                    await self.job(write_private,folder/'install-last216.json',{'installed':False,'error':failure,
                        'source_preserved':True,'stage':(self.progress or {}).get('step'),'recorded_at':int(time.time())})
                    self.update('Instalação não concluída; dados de origem preservados')
    def close(self):self.closed=True

async def dispatch(hass,connection,msg):
    installer=hass.data.get(KEY)
    if installer is None:connection.send_error(msg['id'],'not_loaded','Instalador indisponível.');return
    try:
        result=await (installer.status(msg['sku'],connection) if msg['type']==STATUS else installer.install(msg['sku'],connection,msg['confirmed']))
        installer.guard(connection);connection.send_result(msg['id'],result)
    except asyncio.CancelledError:raise
    except Exception as error:
        code=str(error) if re.fullmatch('[A-Za-z0-9_]{1,100}',str(error)) else 'private_install_unavailable'
        connection.send_error(msg['id'],code,'Não foi possível concluir esta operação. Os dados de origem foram preservados.')
def register(hass,entry,context):
    registry=hass.data.get(websocket_api.DOMAIN,{})
    if KEY in hass.data or any(t in registry for t in (STATUS,INSTALL)):raise ValueError('private_install_handler_conflict')
    installer=Installer(hass,entry,context);hass.data[KEY]=installer;handlers={}
    def close():
        installer.close()
        if hass.data.get(KEY) is installer:hass.data.pop(KEY,None)
        registry=hass.data.get(websocket_api.DOMAIN,{})
        for name,handler in handlers.items():
            if name in registry and registry[name][0] is handler:registry.pop(name)
    try:
        for name in (STATUS,INSTALL):
            schema={probatio.Required('type'):name,probatio.Required('sku'):str}
            if name==INSTALL:schema[probatio.Required('confirmed')]=bool
            handler=websocket_api.websocket_command(schema)(websocket_api.async_response(dispatch))
            websocket_api.async_register_command(hass,handler);handlers[name]=handler
    except BaseException:close();raise
    return close
