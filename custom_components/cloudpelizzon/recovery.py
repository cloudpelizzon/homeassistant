"""Independent recovery plane inside the CloudPelizzon shell.

This file is deliberately kept outside Core, Maintenance and Updater.
A broken module can therefore be rolled back while the CloudPelizzon
shell remains loaded.
"""

from __future__ import annotations

import asyncio
import os
import secrets
import shutil

from pathlib import Path

from homeassistant.helpers.storage import Store

from .const import DOMAIN
from .registry import COMPONENTS


STORE_VERSION = 1
STORE_KEY = "cloudpelizzon_updater.data"


def _atomic_restore(
    source: Path,
    target: Path,
) -> None:

    token = secrets.token_hex(5)

    parent = target.parent

    parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    new = (
        parent
        / f".{target.name}.recovery-new-{token}"
    )

    old = (
        parent
        / f".{target.name}.recovery-old-{token}"
    )

    if new.exists():
        shutil.rmtree(
            new,
            ignore_errors=True,
        )

    shutil.copytree(
        source,
        new,
    )

    try:

        if target.exists():
            os.rename(
                target,
                old,
            )

        os.rename(
            new,
            target,
        )

    except Exception:

        if (
            old.exists()
            and not target.exists()
        ):
            os.rename(
                old,
                target,
            )

        raise

    shutil.rmtree(
        old,
        ignore_errors=True,
    )


async def async_recovery_watch(
    hass,
) -> None:

    # Aguarda o carregamento normal dos módulos.
    await asyncio.sleep(90)

    store = Store(
        hass,
        STORE_VERSION,
        STORE_KEY,
    )

    data = (
        await store.async_load()
        or {}
    )

    pending = dict(
        data.get(
            "pending_healthcheck"
        )
        or {}
    )

    if not pending:
        return

    sku = str(
        pending.get("sku")
        or ""
    )

    meta = COMPONENTS.get(
        sku,
        {},
    )

    runtime_key = (
        pending.get("runtime_key")
        or meta.get("runtime_key")
    )

    platform = hass.data.get(
        DOMAIN
    )

    errors = (
        platform.get(
            "load_errors",
            {},
        )
        if isinstance(
            platform,
            dict,
        )
        else {}
    )

    healthy = bool(
        isinstance(platform, dict)
        and runtime_key
        and runtime_key in platform
        and not errors.get(
            runtime_key
        )
    )

    if healthy:

        data[
            "pending_healthcheck"
        ] = {}

        data["history"] = (
            [
                {
                    "event":
                        "health_ok",
                    **pending,
                }
            ]
            + data.get(
                "history",
                [],
            )[:99]
        )

        await store.async_save(
            data
        )

        updater = platform.get(
            "updater"
        )

        if isinstance(
            updater,
            dict,
        ):

            manager = updater.get(
                "manager"
            )

            if manager:

                await manager._report(
                    "health_ok",
                    pending,
                )

        return

    backup_id = str(
        pending.get(
            "backup_id"
        )
        or ""
    )

    record = next(
        (
            item
            for item
            in data.get(
                "backups",
                [],
            )
            if item.get(
                "backup_id"
            ) == backup_id
        ),
        None,
    )

    if not record:

        data["history"] = (
            [
                {
                    "event":
                        "auto_rollback_failed",
                    "detail":
                        "backup_not_found",
                    **pending,
                }
            ]
            + data.get(
                "history",
                [],
            )[:99]
        )

        await store.async_save(
            data
        )

        return

    source = (
        Path(record["path"])
        / "component"
    )

    component_path = str(
        record.get(
            "component_path"
        )
        or pending.get(
            "component_path"
        )
        or ""
    )

    if not source.exists():

        data["history"] = (
            [
                {
                    "event":
                        "auto_rollback_failed",
                    "detail":
                        "backup_files_missing",
                    **pending,
                }
            ]
            + data.get(
                "history",
                [],
            )[:99]
        )

        await store.async_save(
            data
        )

        return

    if component_path:

        target = (
            Path(
                hass.config.path(
                    "custom_components",
                    DOMAIN,
                )
            )
            / component_path
        )

    else:

        # Compatibilidade com R6.0.
        legacy_domain = str(
            record.get("domain")
            or ""
        )

        if not legacy_domain:
            return

        target = Path(
            hass.config.path(
                "custom_components",
                legacy_domain,
            )
        )

    try:

        _atomic_restore(
            source,
            target,
        )

        data[
            "pending_healthcheck"
        ] = {}

        data[
            "restart_required"
        ] = True

        data["history"] = (
            [
                {
                    "event":
                        "auto_rollback",
                    **pending,
                }
            ]
            + data.get(
                "history",
                [],
            )[:99]
        )

        await store.async_save(
            data
        )

        await asyncio.sleep(2)

        await hass.services.async_call(
            "homeassistant",
            "restart",
            {},
            blocking=False,
        )

    except Exception as error:

        data["history"] = (
            [
                {
                    "event":
                        "auto_rollback_failed",
                    "detail":
                        f"{type(error).__name__}: "
                        f"{error}",
                    **pending,
                }
            ]
            + data.get(
                "history",
                [],
            )[:99]
        )

        await store.async_save(
            data
        )



def schedule_recovery_watch(
    hass,
) -> None:

    hass.async_create_background_task(
        async_recovery_watch(
            hass
        ),
        "cloudpelizzon-recovery-watch",
    )
