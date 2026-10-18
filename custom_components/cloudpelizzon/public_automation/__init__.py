"""Management transport only; no event subscription, activation or HA delivery."""
from .editor import Bridge
from . import api


async def create(hass,entry,context):
    def current():
        found=hass.config_entries.async_get_entry(entry.entry_id)
        if found is not entry or found.domain!='cloudpelizzon':raise PermissionError('entry_changed')
        return found
    def read():return dict(current().options.get('automation_ui',{}))
    def save(data):
        found=current()
        hass.config_entries.async_update_entry(found,options={**found.options,'automation_ui':data})
    bridge=Bridge.from_client(hass,context['client'],read,save)
    def read_categories():return dict(current().options.get('automation_rule_ui',{}))
    def save_categories(data):
        found=current()
        hass.config_entries.async_update_entry(found,options={**found.options,'automation_rule_ui':data})
    bridge.metadata(read_categories,save_categories)
    try:close=api.register(hass,bridge)
    except BaseException:
        bridge.close();raise
    return close
