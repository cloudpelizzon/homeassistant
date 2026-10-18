"""Draft CRUD for the original editor. Validation and storage stay on the server."""
import re
from .bridge import Bridge as ReadBridge, CODE, GET, STATUS, detached

CREATE='cloudpelizzon/automation/create'
VALIDATE='cloudpelizzon/automation/validate'
SAVE='cloudpelizzon/automation/save'
DELETE='cloudpelizzon/automation/delete'
EDITOR_CONTRACTS=frozenset((CREATE,VALIDATE,SAVE,DELETE))
FIELDS=frozenset(('alias','description','triggers','conditions','actions','mode','max','max_exceeded'))
DISPLAY=frozenset(('category','cp_category','cp_origin'))
CATEGORY=re.compile(r'[A-Z][A-Z0-9]{1,7}\Z')


def clean_rule(rule):
    if type(rule) is not dict or set(rule)-FIELDS-DISPLAY:raise ValueError('rule_fields_invalid')
    if 'cp_origin' in rule and rule['cp_origin']!='customer':raise ValueError('private_rule_not_editable')
    category=rule.get('category',rule.get('cp_category','CASA'))
    if type(category) is not str or not CATEGORY.fullmatch(category):raise ValueError('category_invalid')
    # These three fields only label the UI. The native rule itself is neither
    # interpreted nor validated locally; the private compiler handles it.
    return detached({k:v for k,v in rule.items() if k in FIELDS}),category


class Bridge(ReadBridge):
    def metadata(self,read,save):
        self.read_categories,self.save_categories=read,save

    def category(self,code):
        value=self.read_categories().get(code,'CASA')
        if type(value) is not str or not CATEGORY.fullmatch(value):raise ValueError('category_store_invalid')
        return value

    async def handle(self,command,args,*,authorized):
        self.check(authorized)
        if command not in EDITOR_CONTRACTS:
            value=await super().handle(command,args,authorized=authorized)
            if command==GET:
                value['rule']={**value['rule'],'cp_origin':'customer','cp_category':self.category(value['code'])}
            elif command==STATUS:
                for row in value['rules']:row['category']=self.category(row['code'])
            return value
        expected={CREATE:{'rule'},VALIDATE:{'code','rule'},SAVE:{'code','revision','rule'},DELETE:{'code','revision'}}
        if type(args) is not dict or set(args)!=expected[command]:raise ValueError('arguments_invalid')
        args=detached(args)
        if command in (SAVE,DELETE) or command==VALIDATE and args['code']:
            if type(args['code']) is not str or not CODE.fullmatch(args['code']):raise ValueError('code_invalid')
        if command==VALIDATE and type(args['code']) is not str:raise ValueError('code_invalid')
        if command in (SAVE,DELETE) and (type(args['revision']) is not int or args['revision']<1):
            raise ValueError('explicit_revision_required')
        category=None
        if 'rule' in args:rule,category=clean_rule(args['rule'])
        async with self.lock:
            if command==VALIDATE:
                value=await self.request('automation.rules.validate',{'rule':rule},authorized)
                if value.get('valid') is not True or value.get('execution_available') is not False:
                    raise ValueError('validation_response_invalid')
                return {'valid':True,'executed':False,'code':args['code']}
            if command==CREATE:
                value=await self.request('automation.rules.create',{'rule':rule},authorized)
                code=value.get('code')
                if (value.get('created') is not True or type(code) is not str or not CODE.fullmatch(code)
                        or type(value.get('revision')) is not int or value['revision']!=1 or value.get('active') is not False):
                    raise ValueError('creation_response_invalid')
            elif command==SAVE:
                value=await self.request('automation.rules.save',{'code':args['code'],'revision':args['revision'],'rule':rule},authorized)
                code=args['code']
                if (value.get('saved') is not True or value.get('code')!=code
                        or type(value.get('revision')) is not int or value['revision']!=args['revision']+1
                        or value.get('active') is not False):raise ValueError('save_response_invalid')
            else:
                value=await self.request('automation.rules.delete',args,authorized)
                code=args['code']
                if value.get('deleted') is not True or value.get('code')!=code:raise ValueError('delete_response_invalid')
            self.check(authorized)
            categories=dict(self.read_categories())
            if len(categories)>1000:raise ValueError('category_store_limit')
            if command==DELETE:categories.pop(code,None)
            else:categories[code]=category
            self.save_categories(categories)
            if command==DELETE:return {'deleted':True,'code':code}
            return {**value,'rule':{**rule,'cp_origin':'customer','cp_category':category}}
