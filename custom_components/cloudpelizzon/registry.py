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


from .module_catalog import MODULES


# Preserve stable paths of previously registered modules. New SKUs derive their
# private package path from their existing public domain metadata.
_PATH_OVERRIDES = {"CP-AUTOMATION": "automation"}


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
}

for _sku, _module in MODULES.items():
    _domain = str(_module["domain"])
    if not _domain.startswith("cloudpelizzon_"):
        raise ValueError(f"Invalid module domain for {_sku}")
    _slug = _PATH_OVERRIDES.get(_sku, _domain.removeprefix("cloudpelizzon_"))
    COMPONENTS[_sku] = {
        "name": _module["name"],
        "path": f"modules/{_slug}",
        "runtime_key": _slug,
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
