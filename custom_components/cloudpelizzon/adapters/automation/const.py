"""Public HA edge configuration; no commercial module engine."""
import re
DOMAIN='cloudpelizzon'
GENERATION=34
ACTIONS=('status','request','preview','run_manual','deliver_pending')
ACTUATOR=re.compile(r'(light|switch|input_boolean)\.[a-z0-9_]+')
ENTITY=re.compile(r'[a-z_]+\.[a-z0-9_]+')
AUTOMATION_MANAGEMENT=frozenset('automation.'+x for x in ('rules.read','rules.create','rules.save','rules.validate','rules.delete','settings.write'))
PREFIXES={'CP-MAINTENANCE':'maintenance.','CP-SOLAR':'solar.','CP-AUTOMATION':'automation.'}

def checked_options(value):
    if not isinstance(value,dict) or set(value)-{'read_entities','allowed_entities','delivery_enabled'}:raise ValueError('options_invalid')
    result={}
    for field,pattern in (('read_entities',ENTITY),('allowed_entities',ACTUATOR)):
        items=value.get(field,[])
        if (not isinstance(items,list) or len(items)>200 or any(not isinstance(e,str) or not pattern.fullmatch(e) for e in items)):
            raise ValueError('entities_invalid')
        result[field]=sorted(set(items))
    enabled=value.get('delivery_enabled',False)
    if type(enabled) is not bool or enabled and not result['allowed_entities']:raise ValueError('delivery_requires_targets')
    result['delivery_enabled']=enabled
    return result
