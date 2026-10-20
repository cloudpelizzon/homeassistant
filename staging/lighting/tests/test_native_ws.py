"""Pure synthetic native WS boundary tests. No HA server and no physical effects."""
import asyncio
import importlib.util
import sys
import types
import unittest
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE))
import native_ws as ws
import native_scope as scope


class Rights:
    def __init__(self, allowed=None):
        self.allowed=set(allowed or ('light.sala',))
        self.calls=[]
    def check_entity(self, entity_id, policy):
        self.calls.append((entity_id, policy))
        return entity_id in self.allowed and policy == 'read'


class Port:
    def __init__(self):
        self.ready=True
        self.iid='install_1'
        self.calls=[]
        self.disabled=False
        self.reply={'saved':True,'revision':2}
        self.st=types.SimpleNamespace(entity_id='light.sala',state='on',attributes={'supported_color_modes':['brightness'],'brightness':180,'latitude':-25})
    def registration_ready(self):return self.ready
    def installation_id(self):return self.iid
    async def issue_grant(self,iid,actor,operation):
        self.calls.append(('grant',iid,actor,operation))
        if self.disabled:return {'sku':'CP-LIGHTING','gateway_verified':True,'license':{'allowed':False}}
        return {'sku':'CP-LIGHTING','gateway_verified':True,'license':{'allowed':True}}
    async def read_page(self,iid,actor,params,request_id):
        self.calls.append(('read',iid,actor,params,request_id))
        return {'revision':1,'rooms':[{'id':'sala','name':'Sala'}],
                'items':[{'entity_id':'light.sala','kind':'light','name':'Sala','visible':True,'room_id':'sala','icon':'bulb','capabilities':['on_off']}],
                'total':1,'preferences':{'theme':'flux'}}
    def state_get(self,id):
        self.calls.append(('state',id))
        return self.st
    async def execute(self,iid,actor,operation,parameters,request_id):
        self.calls.append(('execute',iid,actor,operation,parameters,request_id))
        return self.reply


class Fixtures:
    def __init__(self,port=None):
        self.port=port or Port()
        self.user=types.SimpleNamespace(id='user_1',is_active=True,is_admin=False,system_generated=False,permissions=Rights())
        self.connection=types.SimpleNamespace(user=self.user,closed=False)
        self.hass=types.SimpleNamespace(data={},auth=types.SimpleNamespace(async_get_user=self.get_user))
        self.get_user_count=0
        self.transport=ws.NativeLightingTransport(self.hass,self.port,scope.NativeLightingReadScope)
    async def get_user(self,id):
        self.get_user_count+=1
        return self.user


class NativeWsTests(unittest.IsolatedAsyncioTestCase):
    async def test_inactive_port_never_registers(self):
        port=Port();port.ready=False
        with self.assertRaises(ws.LightingNativeDenied):
            ws.NativeLightingTransport(types.SimpleNamespace(data={}),port,scope.NativeLightingReadScope)

    async def test_authorized_native_snapshot_filters_attrs(self):
        f=Fixtures()
        result=await f.transport.run(f.connection,{'type':ws.SNAPSHOT,'id':1})
        self.assertEqual(result['sku'],'CP-LIGHTING')
        self.assertEqual(result['configuration']['total'],1)
        self.assertEqual(result['states']['light.sala']['state'],'on')
        self.assertNotIn('latitude',str(result))
        self.assertGreater(f.get_user_count,0)

    async def test_no_extra_browser_fields_on_snapshot(self):
        f=Fixtures()
        for k in ('actor_id','installation_id','license','proofs'):
            with self.assertRaises(ws.LightingNativeDenied):
                await f.transport.run(f.connection,{'type':ws.SNAPSHOT,'id':1,k:'forged'})

    async def test_signed_mutation_parameters_and_id(self):
        f=Fixtures()
        result=await f.transport.run(f.connection,{'type':ws.OPERATION,'id':2,'operation':'lighting.entity.configure',
                      'parameters':{'revision':1,'entity_id':'light.sala','name':'Sala'},'request_id':'r_123'})
        self.assertEqual(result['revision'],2)
        self.assertEqual([x for x in f.port.calls if x[0]=='execute'][0][1:4],('install_1','user_1','lighting.entity.configure'))

    async def test_browser_actor_override_denied(self):
        f=Fixtures()
        with self.assertRaises(ws.LightingNativeDenied):
            await f.transport.run(f.connection,{'type':ws.OPERATION,'id':2,'operation':'lighting.room.create',
                     'parameters':{'revision':1},'request_id':'rid','actor_id':'attacker'})
        self.assertFalse(any(x[0]=='execute' for x in f.port.calls))

    async def test_malformed_or_physical_command_denied(self):
        f=Fixtures()
        for op in ('lighting.device.set','lighting.device.turn_off','lighting.trial.activate','lighting.actions.scene'):
            with self.subTest(op=op),self.assertRaises(ws.LightingNativeDenied):
                await f.transport.run(f.connection,{'type':ws.OPERATION,'id':2,'operation':op,'parameters':{},'request_id':'x'})

    async def test_entity_permission_denied_even_if_private_port_would_allow(self):
        f=Fixtures()
        for op,args in [('lighting.entity.bind',{'entity_id':'switch.unauthorized'}),('lighting.entities.assign_room',{'entity_ids':['light.sala','light.secret']})]:
            with self.subTest(op=op),self.assertRaises(ws.LightingNativeDenied):
                await f.transport.run(f.connection,{'type':ws.OPERATION,'id':2,'operation':op,'parameters':args,'request_id':'r'})
        self.assertFalse(any(x[0]=='execute' for x in f.port.calls))

    async def test_discovery_must_be_native_permission_filtered(self):
        f=Fixtures()
        f.port.reply={'items':[{'entity_id':'light.secret','name':'Secret'}],'total':1}
        with self.assertRaises(ws.LightingNativeDenied):
            await f.transport.run(f.connection,{'type':ws.OPERATION,'id':2,'operation':'lighting.entities.discover',
                             'parameters':{'offset':0,'limit':100},'request_id':'r'})

    async def test_deleted_inactive_system_or_changed_user_denied(self):
        for key,value in [('is_active',False),('system_generated',True),('id',None)]:
            f=Fixtures();setattr(f.user,key,value)
            with self.subTest(key=key),self.assertRaises(ws.LightingNativeDenied):
                await f.transport.run(f.connection,{'type':ws.SNAPSHOT,'id':2})
        f=Fixtures();f.hass.auth.async_get_user=lambda id: asyncio.sleep(0,result=None)
        with self.assertRaises(ws.LightingNativeDenied):
            await f.transport.run(f.connection,{'type':ws.SNAPSHOT,'id':2})

    async def test_installation_swap_during_signed_private_call_denied(self):
        f=Fixtures()
        async def changed(*a):f.port.iid='install_2';return {'saved':True,'revision':3}
        f.port.execute=changed
        with self.assertRaises(ws.LightingNativeDenied):
            await f.transport.run(f.connection,{'type':ws.OPERATION,'id':2,'operation':'lighting.room.create','parameters':{},'request_id':'r'})

    async def test_error_redaction_preserves_no_private_exception(self):
        f=Fixtures()
        async def fail(*a):raise RuntimeError('secret-credential-token-private')
        f.port.execute=fail
        with self.assertRaisesRegex(ws.LightingNativeDenied,'^lighting_denied_or_unavailable$') as ctx:
            await f.transport.run(f.connection,{'type':ws.OPERATION,'id':2,'operation':'lighting.room.create','parameters':{},'request_id':'r'})
        self.assertNotIn('secret',str(ctx.exception))

    async def test_lost_access_inside_snapshot_denies(self):
        f=Fixtures();f.port.disabled=True
        with self.assertRaises(ws.LightingNativeDenied):
            await f.transport.run(f.connection,{'type':ws.SNAPSHOT,'id':1})

    async def test_closed_transport_denies_all(self):
        f=Fixtures();f.transport.close()
        with self.assertRaises(ws.LightingNativeDenied):
            await f.transport.run(f.connection,{'type':ws.SNAPSHOT,'id':1})

    async def test_cancellation_rethrown(self):
        f=Fixtures()
        async def cancel(*args):raise asyncio.CancelledError()
        f.port.execute=cancel
        with self.assertRaises(asyncio.CancelledError):
            await f.transport.run(f.connection,{'type':ws.OPERATION,'id':2,'operation':'lighting.room.create','parameters':{},'request_id':'r'})

    async def test_real_registration_guard_and_owned_close(self):
        f=Fixtures()
        registry={};f.hass.data['websocket_api']=registry
        class Api:
            DOMAIN='websocket_api'
            def websocket_command(self,schema):return lambda fn:fn
            def async_response(self,fn):return fn
            def async_register_command(self,hass,fn):registry[ws.SNAPSHOT if ws.SNAPSHOT not in registry else ws.OPERATION]=(fn,{})
        class Schema:
            @staticmethod
            def Required(value):return value
        close=ws.register(f.hass,f.port,scope.NativeLightingReadScope,websocket_api=Api(),schema=Schema)
        self.assertEqual(len(registry),2)
        self.assertIn(ws.KEY,f.hass.data)
        close()
        self.assertNotIn(ws.KEY,f.hass.data)
        self.assertEqual(len(registry),0)

    async def test_discovery_strict_shape_and_no_extra_metadata(self):
        f=Fixtures()
        f.port.reply={'items':[{'entity_id':'light.sala','name':'Sala','kind':'light',
                                'capabilities':['on_off'],'private_claim':'do_not_return'}], 'total':1}
        with self.assertRaises(ws.LightingNativeDenied):
            await f.transport.run(f.connection,{'type':ws.OPERATION,'id':2,'operation':'lighting.entities.discover',
                                                'parameters':{'offset':0,'limit':100},'request_id':'r'})

    async def test_discovery_clean_payload_allowed(self):
        f=Fixtures()
        f.port.reply={'items':[{'entity_id':'light.sala','name':'Sala','kind':'light','capabilities':['on_off']}],'total':1}
        result=await f.transport.run(f.connection,{'type':ws.OPERATION,'id':2,'operation':'lighting.entities.discover',
                                                'parameters':{'offset':0,'limit':100},'request_id':'r'})
        self.assertEqual(result['total'],1)
        self.assertEqual(result['items'][0]['name'],'Sala')

    async def test_browser_cannot_supply_installation_or_actor_inside_parameters(self):
        f=Fixtures()
        for extra in ('actor_id','installation_id','proofs','grant','sku'):
            with self.subTest(extra=extra),self.assertRaises(ws.LightingNativeDenied):
                await f.transport.run(f.connection,{'type':ws.OPERATION,'id':2,'operation':'lighting.room.create',
                                                'parameters':{extra:'spoof'},'request_id':'r'})
        self.assertFalse(any(x[0]=='execute' for x in f.port.calls))

    async def test_config_read_only_behind_native_snapshot(self):
        f=Fixtures()
        with self.assertRaises(ws.LightingNativeDenied):
            await f.transport.run(f.connection,{'type':ws.OPERATION,'id':2,'operation':'lighting.config.read',
                                                'parameters':{'offset':0,'limit':100},'request_id':'r'})

    async def test_schema_and_port_must_be_explicit(self):
        with self.assertRaises(ws.LightingNativeDenied):
            ws.NativeLightingTransport(types.SimpleNamespace(data={}),object(),scope.NativeLightingReadScope)


if __name__=='__main__':unittest.main()
