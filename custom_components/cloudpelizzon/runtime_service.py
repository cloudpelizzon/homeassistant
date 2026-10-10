"""CloudPelizzon protected operational runtime."""

from __future__ import annotations

import json
import logging

from importlib import import_module
from pathlib import Path

from homeassistant.const import Platform


DOMAIN = "cloudpelizzon"

LEGACY_CORE_RUNTIME = "cloudpelizzon_core"
LEGACY_MAINT_RUNTIME = "cloudpelizzon_maintenance"
LEGACY_UPDATER_RUNTIME = "cloudpelizzon_updater"

_LOGGER = logging.getLogger(__name__)


def _platform(hass):
    return hass.data.setdefault(
        DOMAIN,
        {},
    )


def _record_error(
    hass,
    key,
    error,
):
    platform = _platform(hass)

    platform.setdefault(
        "load_errors",
        {},
    )[key] = (
        f"{type(error).__name__}: {error}"
    )

    _LOGGER.exception(
        "CloudPelizzon subsystem failed: %s",
        key,
    )


async def _persist_status(hass):
    platform = _platform(hass)

    payload = {
        "entry_id":
            platform.get("entry_id", ""),

        "loaded":
            bool(platform.get("loaded")),

        "runtime_state":
            platform.get(
                "runtime_state",
                "",
            ),

        "core":
            "core" in platform,

        "updater":
            "updater" in platform,

        "maintenance":
            "maintenance" in platform,

        "energy":
            "energy" in platform,

        "security":
            "security" in platform,

        "frontend":
            bool(
                platform.get(
                    "frontend_loaded"
                )
            ),

        "module_devices":
            bool(
                platform.get(
                    "module_devices"
                )
            ),

        "load_errors":
            dict(
                platform.get(
                    "load_errors",
                    {},
                )
            ),
    }

    path = Path(
        hass.config.path(
            "cloudpelizzon_runtime_status.json"
        )
    )

    text = json.dumps(
        payload,
        ensure_ascii=False,
        indent=2,
    )

    await hass.async_add_executor_job(
        path.write_text,
        text,
        "utf-8",
    )


async def _start_core(
    hass,
    entry,
):
    platform = _platform(hass)

    api = import_module(
        ".core.api",
        __package__,
    )

    license_module = import_module(
        ".core.license",
        __package__,
    )

    storage_module = import_module(
        ".core.storage",
        __package__,
    )

    api.async_register_api(
        hass
    )

    store = storage_module.CoreStore(
        hass
    )

    data = await store.async_load()

    license_manager = (
        license_module.LicenseManager(
            hass,
            store,
        )
    )

    core_runtime = {
        "entry_id":
            entry.entry_id,

        "store":
            store,

        "data":
            data,

        "license_manager":
            license_manager,
    }

    #
    # Control Layer is important, but may not kill licensing.
    #
    try:
        control_module = import_module(
            ".core.control",
            __package__,
        )

        # Customer environments must enforce entitlements. Audit mode was
        # informative only and made an authoritative DENY effectively allowed.
        data["control_mode"] = "enforce"

        control = control_module.ControlLayer(
            hass,
            license_manager,
            store,
            mode=data.get(
                "control_mode",
                "audit",
            ),
        )

        await control.async_initialize()

        core_runtime["control"] = (
            control
        )

    except Exception as error:
        _record_error(
            hass,
            "control",
            error,
        )

    platform["core"] = (
        core_runtime
    )

    hass.data[
        LEGACY_CORE_RUNTIME
    ] = core_runtime

    await store.async_save()

    license_manager.ensure_checkin_task()


async def _start_updater(
    hass,
):
    platform = _platform(hass)

    api = import_module(
        ".updater.api",
        __package__,
    )

    manager_module = import_module(
        ".updater.manager",
        __package__,
    )

    storage_module = import_module(
        ".updater.storage",
        __package__,
    )

    api.async_register_api(
        hass
    )

    store = storage_module.UpdaterStore(
        hass
    )

    await store.async_load()

    manager = manager_module.UpdateManager(
        hass,
        store,
    )

    runtime = {
        "store":
            store,

        "manager":
            manager,
    }

    platform["updater"] = (
        runtime
    )

    hass.data[
        LEGACY_UPDATER_RUNTIME
    ] = runtime


async def _start_maintenance(
    hass,
    entry,
):
    platform = _platform(hass)

    if "core" not in platform:
        raise RuntimeError(
            "core_unavailable"
        )

    api = import_module(
        ".modules.maintenance.api",
        __package__,
    )

    api_compat = import_module(
        ".modules.maintenance.api_compat",
        __package__,
    )

    api_configuration = import_module(
        ".modules.maintenance.api_configuration",
        __package__,
    )

    api_finance = import_module(
        ".modules.maintenance.api_finance",
        __package__,
    )

    api_history = import_module(
        ".modules.maintenance.api_history",
        __package__,
    )

    api_favorites = import_module(
        ".modules.maintenance.api_favorites",
        __package__,
    )

    api_settings = import_module(
        ".modules.maintenance.api_settings",
        __package__,
    )

    api_notifications = import_module(
        ".modules.maintenance.api_notifications",
        __package__,
    )

    alexa_http = import_module(
        ".modules.maintenance.alexa_http",
        __package__,
    )

    intents = import_module(
        ".modules.maintenance.intents",
        __package__,
    )

    licensing = import_module(
        ".modules.maintenance.licensing",
        __package__,
    )

    manager_module = import_module(
        ".modules.maintenance.manager",
        __package__,
    )

    storage_module = import_module(
        ".modules.maintenance.storage",
        __package__,
    )

    const_module = import_module(
        ".modules.maintenance.const",
        __package__,
    )

    notification_module = import_module(
        ".modules.maintenance.notification_engine",
        __package__,
    )

    api.async_register_websocket_api(
        hass
    )

    api_compat.async_register_compat_api(
        hass
    )

    api_configuration.async_register_configuration_api(
        hass
    )

    api_finance.async_register_finance_api(
        hass
    )

    api_history.async_register_history_api(
        hass
    )

    api_favorites.async_register_favorites_api(
        hass
    )

    api_settings.async_register_settings_api(
        hass
    )

    api_notifications.async_register_notifications_api(
        hass
    )

    intents.async_register_intents(
        hass
    )

    alexa_http.async_register_alexa_http(
        hass
    )

    store = storage_module.MaintenanceStore(
        hass
    )

    data = await store.async_load()

    manager = manager_module.MaintenanceManager(
        store
    )

    license_status = (
        await licensing.async_license_status(
            hass
        )
    )

    runtime = {
        entry.entry_id: {
            "sku":
                const_module.MODULE_SKU,

            "version":
                const_module.MODULE_VERSION,

            "store":
                store,

            "manager":
                manager,

            "data":
                data,

            "license_status":
                license_status,
        }
    }

    engine = (
        notification_module.MaintenanceNotificationEngine(
            hass,
            runtime[
                entry.entry_id
            ],
        )
    )

    runtime[
        entry.entry_id
    ][
        "notification_engine"
    ] = engine

    await engine.async_start()

    platform["maintenance"] = (
        runtime
    )

    hass.data[
        LEGACY_MAINT_RUNTIME
    ] = runtime


async def _start_energy(
    hass,
    entry,
):
    platform = _platform(hass)

    if "core" not in platform:
        raise RuntimeError(
            "core_unavailable"
        )

    module = import_module(
        ".modules.energy",
        __package__,
    )

    platform["energy"] = (
        await module.async_setup_runtime(
            hass,
            entry,
        )
    )


async def _start_security(
    hass,
    entry,
):
    platform = _platform(hass)

    if "core" not in platform:
        raise RuntimeError(
            "core_unavailable"
        )

    module = import_module(
        ".modules.security",
        __package__,
    )

    platform["security"] = (
        await module.async_setup_runtime(
            hass,
            entry,
        )
    )


async def _start_platforms(
    hass,
    entry,
):
    await hass.config_entries.async_forward_entry_setups(
        entry,
        [
            Platform.SENSOR,
            Platform.BINARY_SENSOR,
            Platform.ALARM_CONTROL_PANEL,
        ],
    )


async def _start_frontend(
    hass,
):
    platform = _platform(hass)

    module = import_module(
        ".frontend_manager",
        __package__,
    )

    await module.async_register_frontend(
        hass
    )

    platform[
        "frontend_loaded"
    ] = True


async def _start_module_devices(
    hass,
    entry,
):
    platform = _platform(hass)

    module = import_module(
        ".module_devices",
        __package__,
    )

    platform[
        "module_devices"
    ] = await module.async_sync_module_devices(
        hass,
        entry,
    )


async def async_start(
    hass,
    entry,
):
    platform = _platform(hass)

    platform["runtime_state"] = (
        "starting"
    )

    platform.setdefault(
        "load_errors",
        {},
    )

    stages = (
        (
            "core",
            lambda: _start_core(
                hass,
                entry,
            ),
        ),
        (
            "updater",
            lambda: _start_updater(
                hass
            ),
        ),
        (
            "maintenance",
            lambda: _start_maintenance(
                hass,
                entry,
            ),
        ),
        (
            "energy",
            lambda: _start_energy(
                hass,
                entry,
            ),
        ),
        (
            "security",
            lambda: _start_security(
                hass,
                entry,
            ),
        ),
        (
            "platforms",
            lambda: _start_platforms(
                hass,
                entry,
            ),
        ),
        (
            "frontend",
            lambda: _start_frontend(
                hass
            ),
        ),
        (
            "module_devices",
            lambda: _start_module_devices(
                hass,
                entry,
            ),
        ),
    )

    # Commercial modules must not register operational APIs before licensing
    # has been checked. Apply independent WS guards to every new command they
    # register; installed files alone are not evidence of entitlement.
    from .core import commercial_guard

    commercial_skus = {
        "maintenance": "CP-MAINTENANCE",
        "energy": "CP-ENERGY",
        "security": "CP-SECURITY",
    }

    for name, factory in stages:
        # HACS_BOOTSTRAP_OPTIONAL_STAGE_GATE
        optional_stage_dirs = {
            "maintenance": "maintenance",
            "energy": "energy",
            "security": "security",
        }

        optional_dir = optional_stage_dirs.get(name)

        if optional_dir and not (
            Path(__file__).parent
            / "modules"
            / optional_dir
        ).is_dir():
            platform.setdefault(
                "optional_modules",
                {},
            )[name] = "not_installed"

            await _persist_status(hass)
            continue

        sku = commercial_skus.get(name)
        before_commands = None

        if sku:
            try:
                before_commands = commercial_guard.registered_commands(hass)
                core_runtime = platform.get("core", {})
                manager = core_runtime.get("license_manager")
                control = core_runtime.get("control")
                if (
                    manager is None
                    or control is None
                    or getattr(control, "mode", None) != "enforce"
                ):
                    raise RuntimeError("commercial_license_authority_unavailable")

                await manager.async_checkin(force=True)
                entitlement = await control.authorize(sku, installed=True)
                if not entitlement.get("effective_allowed", False):
                    platform.setdefault("optional_modules", {})[name] = (
                        "license_denied:" + str(entitlement.get("status") or "unknown")
                    )
                    if name != "security":
                        await _persist_status(hass)
                        continue

                    # Security is physically safety-critical. Keep the
                    # restricted runtime for disarm/emergency ONLY IF the
                    # installed private package proves it guards arming,
                    # services and HTTP. An older package must never bypass
                    # entitlement simply because it is a security module.
                    from .core.security_contract import (
                        private_emergency_runtime_verified,
                    )
                    private_dir = (
                        Path(__file__).resolve().parent
                        / "modules"
                        / "security"
                    )
                    if not private_emergency_runtime_verified(private_dir):
                        platform.setdefault("optional_modules", {})[name] = (
                            "license_denied:private_safety_contract_missing"
                        )
                        _LOGGER.error(
                            "CP-SECURITY emergency runtime not loaded: "
                            "private package lacks verified revocation guards"
                        )
                        await _persist_status(hass)
                        continue

                    _LOGGER.warning(
                        "CP-SECURITY license denied (%s): starting limited "
                        "safety runtime; arming operations MUST be protected "
                        "by the private package",
                        entitlement.get("status"),
                    )
            except Exception as error:
                _record_error(hass, name + "_authorization", error)
                platform.setdefault("optional_modules", {})[name] = "license_guard_error"
                await _persist_status(hass)
                continue

        try:
            await factory()

        except Exception as error:
            _record_error(hass, name, error)

        finally:
            if sku and before_commands is not None:
                try:
                    commercial_guard.protect_new_commands(hass, before_commands, sku)
                except Exception as error:
                    _record_error(hass, name + "_ws_guard", error)
                    # A failure must not leave unprotected WS commands active.
                    handlers = hass.data.get("websocket_api", {})
                    if isinstance(handlers, dict):
                        for key in set(handlers) - before_commands:
                            handlers.pop(key, None)

        await _persist_status(hass)

    try:
        recovery = import_module(
            ".recovery",
            __package__,
        )

        recovery.schedule_recovery_watch(
            hass
        )

    except Exception as error:
        _record_error(
            hass,
            "recovery",
            error,
        )

    if "core" in platform:
        platform["runtime_state"] = (
            "running"
        )
    else:
        platform["runtime_state"] = (
            "degraded"
        )

    await _persist_status(
        hass
    )


async def async_stop(
    hass,
    entry,
):
    platform = hass.data.get(
        DOMAIN,
        {},
    )

    try:
        unloaded = (
            await hass.config_entries.async_unload_platforms(
                entry,
                [
                    Platform.SENSOR,
                    Platform.BINARY_SENSOR,
                    Platform.ALARM_CONTROL_PANEL,
                ],
            )
        )

        if not unloaded:
            _LOGGER.warning(
                "CloudPelizzon platform unload incomplete"
            )

    except Exception:
        pass

    try:
        security = platform.get(
            "security"
        )

        if security:
            module = import_module(
                ".modules.security",
                __package__,
            )

            await module.async_unload_runtime(
                security
            )

    except Exception:
        pass

    try:
        maintenance = platform.get(
            "maintenance",
            {},
        )

        runtime = maintenance.get(
            entry.entry_id,
            {},
        )

        engine = runtime.get(
            "notification_engine"
        )

        if engine:
            await engine.async_stop()

    except Exception:
        pass

    try:
        core = platform.get(
            "core"
        )

        if isinstance(
            core,
            dict,
        ):
            manager = core.get(
                "license_manager"
            )

            if manager:
                await manager.async_stop()

    except Exception:
        pass

    try:
        frontend = import_module(
            ".frontend_manager",
            __package__,
        )

        frontend.async_unregister_frontend(
            hass
        )

    except Exception:
        pass

    hass.data.pop(
        LEGACY_CORE_RUNTIME,
        None,
    )

    hass.data.pop(
        LEGACY_MAINT_RUNTIME,
        None,
    )

    hass.data.pop(
        LEGACY_UPDATER_RUNTIME,
        None,
    )
