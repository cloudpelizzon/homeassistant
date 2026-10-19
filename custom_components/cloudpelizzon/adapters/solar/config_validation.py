"""Validate explicit measurement bindings before submitting the private config."""

def validate_measurement_bindings(config):
    groups=config.get('generation',[])+config.get('boards',[])
    rows=list(groups)
    for board in config.get('boards',[]):
        rows.extend(board.get('loads',[]))
    for field in ('power_entity','energy_entity'):
        used=set()
        for row in rows:
            entity=row.get(field)
            if not entity:continue
            if entity in used:raise ValueError('duplicate_measurement_binding')
            used.add(entity)
    grid=config.get('grid',{})
    for kind in ('power','energy'):
        imported=grid.get('import_'+kind+'_entity')
        if imported and imported==grid.get('export_'+kind+'_entity'):
            raise ValueError('grid_import_export_same_measurement')
