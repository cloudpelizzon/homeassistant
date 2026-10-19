import importlib.util,sys,unittest
from pathlib import Path

spec=importlib.util.spec_from_file_location('bindings',Path(sys.argv.pop(1))/'adapters/solar/config_validation.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class Bindings(unittest.TestCase):
    def test_independent_measurements(self):
        module.validate_measurement_bindings({'generation':[{'power_entity':'sensor.pv','energy_entity':'sensor.pv_energy'}],'boards':[{'power_entity':'sensor.board','loads':[{'power_entity':'sensor.plug'}]}]})
    def test_duplicates_are_rejected(self):
        for field in ('power_entity','energy_entity'):
            with self.subTest(field=field),self.assertRaisesRegex(ValueError,'duplicate_measurement'):
                module.validate_measurement_bindings({'generation':[{field:'sensor.same'},{field:'sensor.same'}]})
    def test_grid_directions_are_separate(self):
        for kind in ('power','energy'):
            with self.subTest(kind=kind),self.assertRaisesRegex(ValueError,'grid_import_export_same'):
                module.validate_measurement_bindings({'grid':{'import_'+kind+'_entity':'sensor.same','export_'+kind+'_entity':'sensor.same'}})
    def test_empty_optional_measurements(self):
        module.validate_measurement_bindings({'generation':[{'energy_entity':''},{'energy_entity':''}],'grid':{'import_energy_entity':'','export_energy_entity':''}})
if __name__=='__main__':unittest.main()
