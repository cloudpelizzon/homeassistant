"""Original Automation UI read/preferences transport. No rules engine or effects."""
import asyncio
import functools
import json
import re
import uuid

STATUS='cloudpelizzon/automation/status'
GET='cloudpelizzon/automation/get'
SETTINGS='cloudpelizzon/automation/settings'
CONTRACTS=frozenset((STATUS,GET,SETTINGS))
CODE=re.compile(r'CUS-[0-9]{8}\Z')
ENTITY=re.compile(r'automation\.[a-z0-9_]+\Z')
DEFAULT={'scope':'all','rule_selection':[],'native_selection':[],'category_selection':[],
         'category_names':{},'native_visible':True}


def detached(value):
    raw=json.dumps(value,allow_nan=False,ensure_ascii=False,separators=(',',':'))
    if len(raw.encode())>49152:raise ValueError('payload_limit')
    return json.loads(raw)


def preferences(value):
    if type(value) is not dict or set(value)!=set(DEFAULT):raise ValueError('settings_fields')
    if value['scope'] not in ('all','selected') or value['native_visible'] is not True:raise ValueError('settings_invalid')
    for field,pattern,limit in (('rule_selection',CODE,1000),('native_selection',ENTITY,2000),
                                ('category_selection',re.compile(r'[A-Z][A-Z0-9]{1,7}\Z'),100)):
        items=value[field]
        if type(items) is not list or len(items)>limit or any(type(x) is not str or not pattern.fullmatch(x) for x in items):
            raise ValueError('selection_invalid')
        if len(set(items))!=len(items):raise ValueError('duplicate_selection')
    names=value['category_names']
    if type(names) is not dict or len(names)>100:raise ValueError('category_names_invalid')
    for key,name in names.items():
        if (type(key) is not str or not re.fullmatch('[A-Z][A-Z0-9]{1,7}',key)
                or type(name) is not str or not 1<=len(name)<=80 or not name.isprintable()):
            raise ValueError('category_name_invalid')
    result=detached(value)
    result['rule_selection']=sorted(result['rule_selection'])
    return result


class Bridge:
    def __init__(self,execute,read_local,save_local):
        self.execute,self.read_local,self.save_local=execute,read_local,save_local
        self.closed=False;self.lock=asyncio.Lock()

    @classmethod
    def from_client(cls,hass,client,read_local,save_local):
        async def execute(operation,args):
            call=functools.partial(client.execute,'CP-AUTOMATION',operation,args,request_id=uuid.uuid4().hex)
            return await hass.async_add_executor_job(call)
        return cls(execute,read_local,save_local)

    def close(self):self.closed=True

    def check(self,authorized):
        if self.closed or authorized() is not True:raise PermissionError('active_admin_required')

    async def request(self,operation,args,authorized):
        self.check(authorized)
        value=detached(await self.execute(operation,detached(args)))
        self.check(authorized)
        return value

    async def handle(self,command,args,*,authorized):
        self.check(authorized)
        expected={STATUS:set(),GET:{'code'},SETTINGS:{'settings'}}
        if command not in expected or type(args) is not dict or set(args)!=expected[command]:raise ValueError('arguments_invalid')
        if command==GET:
            code=args['code']
            if type(code) is not str or not CODE.fullmatch(code):raise ValueError('code_invalid')
            value=await self.request('automation.rules.read',{'code':code},authorized)
            if (value.get('code')!=code or type(value.get('revision')) is not int or value['revision']<1
                    or type(value.get('rule')) is not dict or value.get('active') is not False):raise ValueError('rule_response_invalid')
            return {'rule':value['rule'],'revision':value['revision'],'code':code,'active':False}
        if command==STATUS:
            value=await self.request('automation.rules.read',{},authorized)
            if (type(value.get('rules')) is not list or len(value['rules'])>1000
                    or value.get('execution_available') is not False
                    or type(value.get('default_catalog_rules')) is not int or value['default_catalog_rules']!=0):
                raise ValueError('status_response_invalid')
            rows=[];seen=set()
            for row in value['rules']:
                if (type(row) is not dict or type(row.get('code')) is not str or not CODE.fullmatch(row['code'])
                        or row['code'] in seen or type(row.get('revision')) is not int or row['revision']<1
                        or type(row.get('alias')) is not str or len(row['alias'])>350 or row.get('active') is not False):
                    raise ValueError('status_rule_invalid')
                seen.add(row['code'])
                rows.append({k:row[k] for k in ('code','revision','alias','active')}|{'origin':'customer'})
            remote=value.get('settings')
            if type(remote) is not dict or set(remote)!={'scope','rule_selection'}:raise ValueError('remote_settings_invalid')
            settings=preferences({**DEFAULT,**self.read_local(),**remote})
            return {'rules':rows,'settings':settings,'native_rules':[],'categories':[],
                    'total':len(rows),'active':0,'execution_available':False,'default_catalog_rules':0}
        # Native HA entity selectors are UI preferences and remain on HA. Only
        # module rule selectors cross the gateway. No native automation content
        # or current states are read by this transport.
        settings=preferences(args['settings'])
        async with self.lock:
            self.check(authorized)
            remote={k:settings[k] for k in ('scope','rule_selection')}
            value=await self.request('automation.settings.write',{'settings':remote},authorized)
            if value.get('saved') is not True or value.get('settings')!=remote:raise ValueError('settings_response_invalid')
            self.save_local({k:v for k,v in settings.items() if k not in remote})
            return {'saved':True,'settings':settings}
