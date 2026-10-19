"""Actual HA lifecycle, schemas and executor; synthetic SDK, no devices/network."""
import asyncio,copy,shutil,threading,types,unittest,uuid
from pathlib import Path
from homeassistant import loader
from homeassistant.core import HomeAssistant
from homeassistant.components import websocket_api
from client81.public_automation import create,api
from client81.public_automation.execution124 import ACTIVATE,DEACTIVATE,PERMISSIONS,APPROVE

class NativeAutomationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.root=Path('/tmp')/('cp-automation125-'+uuid.uuid4().hex);self.root.mkdir()
        self.hass=HomeAssistant(str(self.root));loader.async_setup(self.hass);await self.hass.async_start()
        self.entry=types.SimpleNamespace(domain='cloudpelizzon',entry_id='synthetic125',options={'preserve':True})
        def update(entry,**changes):entry.options=changes['options']
        self.old_manager=self.hass.config_entries
        self.hass.config_entries=types.SimpleNamespace(async_get_entry=lambda iid:self.entry if iid==self.entry.entry_id else None,async_update_entry=update)
        outer=self;self.calls=[]
        class SDK:
            def status(self):return {'modules':{'CP-AUTOMATION':{'phase':'not_started','paid_confirmed':False}}}
            def worker_session(self,args,**kwargs):
                outer.calls.append(('session',copy.deepcopy(args),threading.get_ident()))
                return {'prepared':True,'policy':args['policy'],'trial_started':False} if args['action']=='prepare' else {'closed':True}
            def execute(self,sku,operation,args,**kwargs):
                outer.calls.append(('execute',operation,threading.get_ident()))
                if operation=='automation.rules.read':return {'rules':[{'code':'CUS-00000001','alias':'synthetic','revision':1,'active':True}],
                    'execution_available':False,'default_catalog_rules':0,'settings':{'scope':'all','rule_selection':[]}}
                return {'code':args['code'],'revision':args['revision'],'active':operation.endswith('.activate')}
        self.context={'client':SDK(),'trial_id':'synthetic-native-automation125'}
        self.close=await create(self.hass,self.entry,self.context);self.edge=self.context['automation_edge']
    async def asyncTearDown(self):
        self.close();await asyncio.gather(self.edge.task,return_exceptions=True)
        self.hass.config_entries=self.old_manager;await self.hass.async_stop()
        assert self.root.parent==Path('/tmp') and self.root.name.startswith('cp-automation125-');shutil.rmtree(self.root)
    async def invoke(self,command,args=None,admin=True):
        connection=types.SimpleNamespace(user=types.SimpleNamespace(is_active=True,is_admin=admin),result=None,error=None)
        connection.send_result=lambda i,value:setattr(connection,'result',value)
        connection.send_error=lambda *value:setattr(connection,'error',value)
        message={'id':1,'type':command,**(args or {})}
        schema=self.hass.data[websocket_api.DOMAIN][command][1]
        if schema is not False:message=schema(message)
        await api.dispatch(self.hass,connection,message);return connection
    async def test_permissions_start_empty_without_starting_trial(self):
        result=await self.invoke(PERMISSIONS);self.assertIsNone(result.error);self.assertEqual(result.result['policy'],{'reads':[],'targets':[]})
        self.assertFalse(any(row[0]=='execute' for row in self.calls))
    async def test_confirmed_permissions_preserve_existing_options(self):
        result=await self.invoke(APPROVE,{'policy':{'reads':['sensor.synthetic'],'targets':['light.synthetic']},'confirmed':True})
        self.assertIsNone(result.error);self.assertTrue(result.result['prepared']);self.assertTrue(self.entry.options['preserve'])
        self.assertEqual(self.entry.options['automation_runtime124']['targets'],['light.synthetic'])
        self.assertTrue(all(row[2]!=threading.get_ident() for row in self.calls))
    async def test_nonadmin_cannot_grant_permissions(self):
        result=await self.invoke(APPROVE,{'policy':{'reads':[],'targets':['light.synthetic']},'confirmed':True},admin=False)
        self.assertIsNotNone(result.error);self.assertNotIn('automation_runtime124',self.entry.options)
        self.assertFalse(any(row[0]=='session' for row in self.calls))
    async def test_activation_prepares_session_then_changes_one_rule(self):
        result=await self.invoke(ACTIVATE,{'code':'CUS-00000001','revision':1})
        self.assertIsNone(result.error);self.assertTrue(result.result['active'])
        self.assertEqual([row[0] for row in self.calls],['session','execute'])
        result=await self.invoke(DEACTIVATE,{'code':'CUS-00000001','revision':1})
        self.assertIsNone(result.error);self.assertFalse(result.result['active'])
    async def test_active_rule_status_does_not_require_false_flags(self):
        result=await self.invoke('cloudpelizzon/automation/status')
        self.assertIsNone(result.error);self.assertEqual(result.result['active'],1)
    async def test_owned_unload_removes_new_commands_and_blocks_old_dispatch(self):
        token=self.edge.generation;self.close()
        for command in (ACTIVATE,DEACTIVATE,PERMISSIONS,APPROVE):self.assertNotIn(command,self.hass.data[websocket_api.DOMAIN])
        with self.assertRaises(PermissionError):await self.edge.dispatch(token,{'reads':[],'targets':[]},'light.turn_on',{'entity_id':'light.synthetic'})
