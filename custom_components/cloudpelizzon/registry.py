"""CloudPelizzon component registry.

One Home Assistant integration:
    cloudpelizzon

Multiple independently versioned internal components:
    core/
    updater/
    modules/*
"""

from __future__ import annotations

from pathlib import Path


PLATFORM_DOMAIN = "cloudpelizzon"


COMPONENTS = {
    "CP-CORE": {
        "name": "CloudPelizzon Core",
        "path": "core",
        "runtime_key": "core",
    },

    "CP-UPDATER": {
        "name": "Central de Atualizações",
        "path": "updater",
        "runtime_key": "updater",
    },

    "CP-MAINTENANCE": {
        "name": "Manutenção",
        "path": "modules/maintenance",
        "runtime_key": "maintenance",
    },

    "CP-NOC": {
        "name": "NOC",
        "path": "modules/noc",
        "runtime_key": "noc",
    },

    "CP-ALEXA": {
        "name": "Alexa",
        "path": "modules/alexa",
        "runtime_key": "alexa",
    },

    "CP-ENERGY": {
        "name": "Geração e Consumo de Energia",
        "path": "modules/energy",
        "runtime_key": "energy",
    },

    "CP-BACKUP": {
        "name": "Backup",
        "path": "modules/backup",
        "runtime_key": "backup",
    },

    "CP-SECURITY": {
        "name": "Segurança",
        "path": "modules/security",
        "runtime_key": "security",
    },

    "CP-AUTOMATION": {
        "name": "Automation Intelligence Center",
        "path": "modules/automation",
        "runtime_key": "automation",
    },

    "CP-AMBIENTE": {
        "name": "Ambiente",
        "path": "modules/ambiente",
        "runtime_key": "ambiente",
    },

    "CP-FITOS": {
        "name": "FIT OS",
        "path": "modules/fitos",
        "runtime_key": "fitos",
    },
}


def component_directory(hass, sku: str) -> Path | None:
    meta = COMPONENTS.get(sku)

    if not meta:
        return None

    return (
        Path(hass.config.path("custom_components"))
        / PLATFORM_DOMAIN
        / meta["path"]
    )


def module_installed(hass, sku: str) -> bool:
    path = component_directory(hass, sku)
    return bool(path and path.is_dir())
