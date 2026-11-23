"""Explicit optional manufacturer metadata for the consented map export."""
import copy

def validate_brands(document,validate_original):
    # Preserve the original strict validation of every other field.
    clean=copy.deepcopy(document)
    for item in clean.get('network',{}).get('presentation',{}).values():
        if 'manufacturer' in item:
            brand=item.pop('manufacturer')
            if type(brand) is not str or len(brand)>160 or any(ord(c)<32 for c in brand):
                raise ValueError('invalid_visual_manufacturer')
    validate_original(clean)
    return document

def add_brands(document,store):
    with store.connect() as db:
        brands={row[0]:(row[1] or '') for row in db.execute('SELECT id,manufacturer FROM assets WHERE archived=0')}
    for key,item in document['network']['presentation'].items():
        brand=brands.get(key,'')
        item['manufacturer']=''.join(c for c in str(brand) if ord(c)>=32).strip()[:160]
    return document
