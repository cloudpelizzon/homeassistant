"""Registry compatibility and large-installation telemetry regression."""
import sys,types,unittest,time
from unittest.mock import patch
from client81 import telemetry437 as telemetry
N=types.SimpleNamespace
class EntryView:
 def __init__(self,rows):self.rows=rows
 def __iter__(self):return iter(self.rows)
 def get(self,*args):raise AssertionError('deprecated mapping lookup')
 def values(self):raise AssertionError('deprecated mapping enumeration')
class Tests(unittest.TestCase):
 def run_collection(self,legacy):
  devices=[N(id=str(i),disabled_by=None,area_id='room',labels=()) for i in range(1000)]
  entities={f'sensor.synthetic_{i}':N(entity_id=f'sensor.synthetic_{i}',device_id=str(i%1000),disabled_by=None,entity_category=None,platform='synthetic',area_id=None,labels=()) for i in range(12000)}
  view={d.id:d for d in devices} if legacy else EntryView(devices)
  states=N(get=lambda eid:N(state='unavailable' if int(eid.rsplit('_',1)[1])%3==0 else 'on',attributes={}))
  hass=N(states=states,config_entries=N(async_entries=lambda:[]),data={},is_running=True)
  labels=N(async_get_label_by_name=lambda name:None)
  with patch.object(telemetry,'lighting_interface461',return_value=False),patch.object(telemetry.dr,'async_get',return_value=N(devices=view)),patch.object(telemetry.er,'async_get',return_value=N(entities=entities)),patch.object(sys.modules['homeassistant.helpers.label_registry'],'async_get',return_value=labels):
   start=time.monotonic();result=telemetry.collect(hass);duration=time.monotonic()-start
  self.assertEqual(result['entities']['total'],12000)
  self.assertEqual(result['entities']['unavailable'],4000)
  self.assertEqual(result['devices']['total'],1000)
  self.assertEqual(result['usage444']['entities']['total'],12000)
  self.assertEqual(sum(x['total'] for x in result['details447']['kinds']),12000)
  self.assertLess(duration,1.0)
 def test_current_entry_iterator_has_no_deprecated_mapping_calls(self):self.run_collection(False)
 def test_legacy_mapping_has_identical_counts(self):self.run_collection(True)
