"""Secure path-based Release Center manager for CloudPelizzon."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import py_compile
import secrets
import shutil
import tarfile
import time

from datetime import datetime, timezone
from pathlib import Path

from homeassistant.helpers.aiohttp_client import (
    async_get_clientsession,
)

from .const import (
    COMPONENTS,
    CORE_STORAGE_FILE,
    DEFAULT_SERVER_URL,
    PLATFORM_DOMAIN,
    VERSION,
)


_SHA256_DER_PREFIX = bytes.fromhex(
    "3031300d060960864801650304020105000420"
)


def _now():
    return datetime.now(timezone.utc).isoformat()


def _b64u(value: bytes):
    return (
        base64.urlsafe_b64encode(value)
        .rstrip(b"=")
        .decode()
    )


def _b64ud(value: str):
    value += "=" * ((4 - len(value) % 4) % 4)
    return base64.urlsafe_b64decode(value.encode())


def _canonical(data):
    return json.dumps(
        data,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode()


def _version_key(value):
    import re

    nums = [
        int(x)
        for x in re.findall(
            r"\d+",
            str(value or ""),
        )[:4]
    ]

    return tuple(
        nums + [0] * (4 - len(nums))
    )


class UpdateError(RuntimeError):
    pass


class UpdateManager:

    def __init__(self, hass, store):

        self.hass = hass
        self.store = store
        self.data = store.data

        self.root = Path(
            hass.config.path(
                "cloudpelizzon-updater"
            )
        )

        self.downloads = (
            self.root / "downloads"
        )

        self.staging = (
            self.root / "staging"
        )

        self.backup_root = Path(
            hass.config.path(
                "cloudpelizzon-backups",
                "release-center",
            )
        )

        for path in (
            self.root,
            self.downloads,
            self.staging,
            self.backup_root,
        ):
            path.mkdir(
                parents=True,
                exist_ok=True,
            )


    def _platform_root(self):

        return (
            Path(
                self.hass.config.path(
                    "custom_components"
                )
            )
            / PLATFORM_DOMAIN
        )


    def _component_path(self, sku):

        meta = COMPONENTS.get(sku)

        if not meta:
            raise UpdateError(
                "unknown_component"
            )

        return (
            self._platform_root()
            / meta["path"]
        )


    def _core_data(self):

        path = Path(
            self.hass.config.path(
                CORE_STORAGE_FILE
            )
        )

        try:

            obj = json.loads(
                path.read_text(
                    encoding="utf-8"
                )
            )

            data = (
                obj.get("data")
                if isinstance(obj, dict)
                else None
            )

            if isinstance(data, dict):
                return data

        except Exception:
            pass

        platform = self.hass.data.get(
            PLATFORM_DOMAIN
        )

        if isinstance(platform, dict):

            core = platform.get("core")

            if (
                isinstance(core, dict)
                and isinstance(
                    core.get("data"),
                    dict,
                )
            ):
                return core["data"]

        return {}


    def _credentials(self):

        data = self._core_data()

        iid = str(
            data.get("installation_id")
            or ""
        ).strip()

        aid = str(
            data.get("activation_id")
            or ""
        ).strip()

        secret = str(
            data.get("activation_secret")
            or ""
        ).strip()

        url = str(
            data.get("license_server_url")
            or DEFAULT_SERVER_URL
        ).rstrip("/")

        if not iid:
            raise UpdateError(
                "installation_id_missing"
            )

        if not aid or not secret:
            raise UpdateError(
                "online_activation_required"
            )

        return url, iid, aid, secret


    def _auth(
        self,
        purpose,
        extra="",
    ):

        url, iid, aid, secret = (
            self._credentials()
        )

        timestamp = int(time.time())

        nonce = secrets.token_urlsafe(18)

        message = (
            f"{purpose}\n"
            f"{aid}\n"
            f"{iid}\n"
            f"{timestamp}\n"
            f"{nonce}\n"
            f"{extra}"
        ).encode()

        signature = _b64u(
            hmac.new(
                secret.encode(),
                message,
                hashlib.sha256,
            ).digest()
        )

        return url, {
            "activation_id": aid,
            "installation_id": iid,
            "timestamp": timestamp,
            "nonce": nonce,
            "signature": signature,
        }


    async def _get_json(
        self,
        path,
    ):

        url, _, _, _ = self._credentials()

        session = async_get_clientsession(
            self.hass
        )

        async with session.get(
            f"{url}/{path.lstrip('/')}",
            timeout=20,
        ) as response:

            body = await response.json(
                content_type=None
            )

            if response.status != 200:

                raise UpdateError(
                    body.get("error")
                    or f"http_{response.status}"
                )

            return body


    async def _post_json(
        self,
        path,
        payload,
    ):

        url, _, _, _ = self._credentials()

        session = async_get_clientsession(
            self.hass
        )

        async with session.post(
            f"{url}/{path.lstrip('/')}",
            json=payload,
            timeout=40,
        ) as response:

            body = await response.json(
                content_type=None
            )

            if response.status != 200:

                raise UpdateError(
                    body.get("error")
                    or body.get("status")
                    or f"http_{response.status}"
                )

            return body


    def installed_components(self):

        output = {}

        for sku, meta in COMPONENTS.items():

            target = self._component_path(
                sku
            )

            manifest = (
                target / "manifest.json"
            )

            if not manifest.exists():
                continue

            try:

                data = json.loads(
                    manifest.read_text(
                        encoding="utf-8"
                    )
                )

                version = str(
                    data.get("version")
                    or ""
                )

            except Exception:

                version = ""

            output[sku] = {
                "sku": sku,
                "name": meta["name"],
                "component_path": meta["path"],
                "version": version,
            }

        return output


    def _ha_version(self):

        try:

            from homeassistant.const import (
                __version__,
            )

            return str(__version__)

        except Exception:

            return ""


    async def async_trust(
        self,
        trust=None,
    ):

        trust = (
            trust
            or await self._get_json(
                "releases/trust"
            )
        )

        fingerprint = str(
            trust.get("fingerprint")
            or ""
        )

        if (
            not fingerprint
            or not trust.get("n")
            or not trust.get("e")
        ):
            raise UpdateError(
                "release_trust_invalid"
            )

        pinned = str(
            self.data.get(
                "release_key_fingerprint"
            )
            or ""
        )

        if (
            pinned
            and pinned != fingerprint
        ):
            raise UpdateError(
                "release_signing_key_changed"
            )

        if not pinned:

            self.data[
                "release_key_fingerprint"
            ] = fingerprint

            self.data[
                "release_public_n"
            ] = str(trust["n"])

            self.data[
                "release_public_e"
            ] = int(trust["e"])

            await self.store.async_save()

        return fingerprint


    def _verify_release_signature(
        self,
        release,
    ):

        signed = (
            release.get("signed")
            or {}
        )

        signature_text = str(
            release.get("signature")
            or ""
        )

        if (
            not signed
            or not signature_text
        ):
            raise UpdateError(
                "release_signature_missing"
            )

        n = int(
            self.data.get(
                "release_public_n"
            )
            or 0
        )

        e = int(
            self.data.get(
                "release_public_e"
            )
            or 0
        )

        if not n or not e:
            raise UpdateError(
                "release_trust_not_pinned"
            )

        raw = _canonical(signed)

        signature = _b64ud(
            signature_text
        )

        key_size = (
            n.bit_length() + 7
        ) // 8

        if len(signature) != key_size:
            raise UpdateError(
                "release_signature_invalid"
            )

        encoded = pow(
            int.from_bytes(
                signature,
                "big",
            ),
            e,
            n,
        ).to_bytes(
            key_size,
            "big",
        )

        digest_info = (
            _SHA256_DER_PREFIX
            + hashlib.sha256(
                raw
            ).digest()
        )

        padding = (
            key_size
            - len(digest_info)
            - 3
        )

        expected = (
            b"\x00\x01"
            + (b"\xff" * padding)
            + b"\x00"
            + digest_info
        )

        if (
            padding < 8
            or not hmac.compare_digest(
                encoded,
                expected,
            )
        ):
            raise UpdateError(
                "release_signature_invalid"
            )

        return True


    async def async_check(self):

        try:

            components = {
                sku: item["version"]
                for sku, item
                in self.installed_components().items()
            }

            core_version = components.get(
                "CP-CORE",
                "",
            )

            _, auth = self._auth(
                "release_check"
            )

            body = await self._post_json(
                "releases/check",
                {
                    **auth,
                    "components": components,
                    "core_version": core_version,
                    "ha_version": self._ha_version(),
                },
            )

            await self.async_trust(
                body.get("trust")
                or {}
            )

            for release in (
                body.get("releases")
                or []
            ):

                if (
                    release.get("status")
                    == "published"
                    and release.get(
                        "signature"
                    )
                ):
                    self._verify_release_signature(
                        release
                    )

            # HACS_BOOTSTRAP_RELEASE_FILTER
            # Bootstrap/Core belong to HACS.
            # Update Center may manage only modules/*.
            body["releases"] = [
                release
                for release in (
                    body.get("releases")
                    or []
                )
                if str(
                    (
                        COMPONENTS.get(
                            release.get("sku")
                        )
                        or {}
                    ).get("path")
                    or ""
                ).startswith("modules/")
            ]

            self.data[
                "last_check_at"
            ] = _now()

            self.data[
                "last_check_error"
            ] = ""

            self.data[
                "channel"
            ] = (
                body.get("channel")
                or "stable"
            )

            self.data[
                "releases"
            ] = (
                body.get("releases")
                or []
            )

            self.data[
                "documentation"
            ] = (
                body.get(
                    "documentation"
                )
                or []
            )

            await self.store.async_save()

            return self.status()

        except Exception as error:

            self.data[
                "last_check_error"
            ] = (
                f"{type(error).__name__}: "
                f"{error}"
            )

            await self.store.async_save()

            raise


    async def async_download(
        self,
        release_id,
    ):

        release = next(
            (
                item
                for item
                in self.data.get(
                    "releases",
                    [],
                )
                if item.get(
                    "release_id"
                ) == release_id
            ),
            None,
        )

        if not release:

            await self.async_check()

            release = next(
                (
                    item
                    for item
                    in self.data.get(
                        "releases",
                        [],
                    )
                    if item.get(
                        "release_id"
                    ) == release_id
                ),
                None,
            )

        if not release:
            raise UpdateError(
                "release_not_available"
            )

        self._verify_release_signature(
            release
        )

        _, auth = self._auth(
            "release_download",
            release_id,
        )

        current = (
            self.installed_components()
            .get(
                release["sku"],
                {},
            )
            .get(
                "version",
                "",
            )
        )

        url, _, _, _ = (
            self._credentials()
        )

        session = async_get_clientsession(
            self.hass
        )

        async with session.post(
            f"{url}/releases/download",
            json={
                **auth,
                "release_id": release_id,
                "current_version": current,
            },
            timeout=120,
        ) as response:

            if response.status != 200:

                try:
                    body = await response.json(
                        content_type=None
                    )

                    reason = body.get(
                        "error"
                    )

                except Exception:

                    reason = (
                        await response.text()
                    )

                raise UpdateError(
                    reason
                    or f"http_{response.status}"
                )

            raw = await response.read()

        if len(raw) != int(
            release.get(
                "package_size"
            )
            or len(raw)
        ):
            raise UpdateError(
                "release_size_mismatch"
            )

        if (
            hashlib.sha256(
                raw
            ).hexdigest()
            != release.get("sha256")
        ):
            raise UpdateError(
                "release_hash_mismatch"
            )

        path = (
            self.downloads
            / f"{release_id}.tar.gz"
        )

        path.write_bytes(raw)

        return path, release


    def _safe_extract(
        self,
        archive,
        destination,
    ):

        if destination.exists():
            shutil.rmtree(
                destination
            )

        destination.mkdir(
            parents=True
        )

        root = str(
            destination.resolve()
        )

        with tarfile.open(
            archive,
            "r:gz",
        ) as tar:

            for member in tar.getmembers():

                name = member.name.replace(
                    "\\",
                    "/",
                )

                while name.startswith("./"):
                    name = name[2:]

                parts = Path(name).parts

                if (
                    member.issym()
                    or member.islnk()
                    or name.startswith("/")
                    or ".." in parts
                ):
                    raise UpdateError(
                        "release_package_unsafe"
                    )

                target = (
                    destination / name
                ).resolve()

                try:

                    common = os.path.commonpath(
                        [
                            root,
                            str(target),
                        ]
                    )

                except ValueError:

                    raise UpdateError(
                        "release_package_unsafe"
                    )

                if common != root:
                    raise UpdateError(
                        "release_package_unsafe"
                    )

            tar.extractall(
                destination
            )


    def _validate_source(
        self,
        source,
        expected_version,
    ):

        manifest = (
            source / "manifest.json"
        )

        if not manifest.exists():
            raise UpdateError(
                "manifest_missing"
            )

        data = json.loads(
            manifest.read_text(
                encoding="utf-8"
            )
        )

        if str(
            data.get("version")
            or ""
        ) != str(
            expected_version
        ):
            raise UpdateError(
                "manifest_version_mismatch"
            )

        for file in source.rglob(
            "*.py"
        ):
            py_compile.compile(
                str(file),
                doraise=True,
            )


    def _atomic_replace(
        self,
        source,
        target,
    ):

        token = secrets.token_hex(5)

        parent = target.parent

        parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        new = (
            parent
            / f".{target.name}.new-{token}"
        )

        old = (
            parent
            / f".{target.name}.old-{token}"
        )

        if new.exists():
            shutil.rmtree(new)

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

            if new.exists():
                shutil.rmtree(
                    new,
                    ignore_errors=True,
                )

            raise

        shutil.rmtree(
            old,
            ignore_errors=True,
        )


    async def async_install(
        self,
        release_id,
    ):

        archive, release = (
            await self.async_download(
                release_id
            )
        )

        sku = release["sku"]

        meta = COMPONENTS.get(sku)

        if not meta:
            raise UpdateError(
                "unknown_component"
            )

        # HACS_BOOTSTRAP_OWNERSHIP_GATE
        component_path = str(
            meta.get("path")
            or ""
        )

        if not component_path.startswith("modules/"):
            raise UpdateError(
                "component_managed_by_hacs"
            )

        stage = (
            self.staging
            / release_id
        )

        self._safe_extract(
            archive,
            stage,
        )

        source = (
            stage
            / "custom_components"
            / PLATFORM_DOMAIN
            / meta["path"]
        )

        if not source.exists():
            raise UpdateError(
                "release_component_missing"
            )

        self._validate_source(
            source,
            release["version"],
        )

        target = self._component_path(
            sku
        )

        current = (
            self.installed_components()
            .get(
                sku,
                {},
            )
            .get(
                "version",
                "",
            )
        )

        # Commercial releases must never downgrade a customer installation.
        # Rollback is an explicit, separate, audited operation.
        if current and _version_key(release["version"]) < _version_key(current):
            raise UpdateError("release_downgrade_not_allowed")

        timestamp = datetime.now().strftime(
            "%Y%m%d-%H%M%S"
        )

        backup_id = (
            f"BKP-"
            f"{sku.replace('CP-', '')}-"
            f"{timestamp}"
        )

        backup_dir = (
            self.backup_root
            / backup_id
        )

        backup_dir.mkdir(
            parents=True,
            exist_ok=True,
        )

        if target.exists():

            shutil.copytree(
                target,
                backup_dir / "component",
            )

        self._atomic_replace(
            source,
            target,
        )

        record = {
            "backup_id": backup_id,
            "sku": sku,
            "domain": PLATFORM_DOMAIN,
            "component_path": meta["path"],
            "runtime_key": meta.get(
                "runtime_key"
            ),
            "from_version": current,
            "to_version": release["version"],
            "release_id": release_id,
            "path": str(backup_dir),
            "created_at": _now(),
        }

        (
            backup_dir
            / "metadata.json"
        ).write_text(
            json.dumps(
                record,
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

        self.data["backups"] = (
            [record]
            + self.data.get(
                "backups",
                [],
            )[:49]
        )

        self.data["history"] = (
            [
                {
                    "ts": _now(),
                    "event":
                        "installed_pending_restart",
                    **record,
                }
            ]
            + self.data.get(
                "history",
                [],
            )[:99]
        )

        self.data[
            "pending_healthcheck"
        ] = dict(record)

        self.data[
            "restart_required"
        ] = True

        await self.store.async_save()

        await self._report(
            "installed",
            record,
        )

        return {
            "ok": True,
            "restart_required": True,
            "backup": record,
            "release": release,
        }


    async def _report(
        self,
        event_type,
        record,
        detail=None,
    ):

        try:

            release_id = str(
                record.get(
                    "release_id"
                )
                or ""
            )

            sku = str(
                record.get("sku")
                or ""
            )

            extra = (
                f"{event_type}:"
                f"{sku}:"
                f"{release_id}"
            )

            _, auth = self._auth(
                "release_report",
                extra,
            )

            await self._post_json(
                "releases/report",
                {
                    **auth,
                    "event_type":
                        event_type,
                    "sku": sku,
                    "release_id":
                        release_id,
                    "from_version":
                        record.get(
                            "from_version"
                        )
                        or "",
                    "to_version":
                        record.get(
                            "to_version"
                        )
                        or "",
                    "backup_id":
                        record.get(
                            "backup_id"
                        )
                        or "",
                    "detail":
                        detail
                        or {},
                },
            )

        except Exception:

            pass


    async def async_rollback(
        self,
        backup_id,
        automatic=False,
    ):

        record = next(
            (
                item
                for item
                in self.data.get(
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
            raise UpdateError(
                "backup_not_found"
            )

        # HACS_BOOTSTRAP_ROLLBACK_GATE
        rollback_meta = COMPONENTS.get(
            str(record.get("sku") or "")
        )

        rollback_component_path = str(
            (rollback_meta or {}).get("path")
            or ""
        )

        if (
            not rollback_meta
            or not rollback_component_path.startswith(
                "modules/"
            )
        ):
            raise UpdateError(
                "component_managed_by_hacs"
            )

        recorded_component_path = str(
            record.get("component_path")
            or ""
        )

        if (
            recorded_component_path
            and recorded_component_path
            != rollback_component_path
        ):
            raise UpdateError(
                "backup_component_mismatch"
            )

        # Registry is authoritative for rollback target.
        # This also upgrades legacy module backups in-memory.
        record["component_path"] = (
            rollback_component_path
        )

        source = (
            Path(record["path"])
            / "component"
        )

        component_path = (
            record.get(
                "component_path"
            )
            or ""
        )

        if component_path:

            target = (
                self._platform_root()
                / component_path
            )

        else:

            # Compatibilidade com backups R6.0.
            legacy_domain = (
                record.get("domain")
                or ""
            )

            if not legacy_domain:
                raise UpdateError(
                    "backup_target_missing"
                )

            target = (
                Path(
                    self.hass.config.path(
                        "custom_components"
                    )
                )
                / legacy_domain
            )

        if not source.exists():
            raise UpdateError(
                "backup_files_missing"
            )

        current = (
            self.installed_components()
            .get(
                record["sku"],
                {},
            )
            .get(
                "version",
                "",
            )
        )

        self._atomic_replace(
            source,
            target,
        )

        event = (
            "auto_rollback"
            if automatic
            else "rollback"
        )

        history = {
            "ts": _now(),
            "event": event,
            "backup_id": backup_id,
            "sku": record["sku"],
            "domain":
                PLATFORM_DOMAIN,
            "component_path":
                component_path,
            "from_version":
                current,
            "to_version":
                record["from_version"],
            "release_id":
                record.get(
                    "release_id",
                    "",
                ),
        }

        self.data["history"] = (
            [history]
            + self.data.get(
                "history",
                [],
            )[:99]
        )

        self.data[
            "pending_healthcheck"
        ] = {}

        self.data[
            "restart_required"
        ] = True

        await self.store.async_save()

        await self._report(
            event,
            history,
        )

        return {
            "ok": True,
            "restart_required": True,
            "restored_version":
                record["from_version"],
            "backup_id": backup_id,
        }


    async def async_restart(self):

        self.data[
            "restart_required"
        ] = False

        await self.store.async_save()

        await self.hass.services.async_call(
            "homeassistant",
            "restart",
            {},
            blocking=False,
        )

        return {
            "ok": True,
        }


    def status(self):

        components = (
            self.installed_components()
        )

        releases = []

        for release in self.data.get(
            "releases",
            [],
        ):

            item = dict(release)

            current = (
                components
                .get(
                    item.get("sku"),
                    {},
                )
                .get(
                    "version",
                    "",
                )
            )

            item[
                "current_version"
            ] = current

            item[
                "update_available"
            ] = (
                bool(
                    current
                    and _version_key(
                        item.get("version")
                    )
                    > _version_key(
                        current
                    )
                )
                or (
                    not current
                    and item.get("sku")
                    != "CP-CORE"
                )
            )

            item[
                "backup_available"
            ] = any(
                backup.get("sku")
                == item.get("sku")
                for backup
                in self.data.get(
                    "backups",
                    [],
                )
            )

            releases.append(item)

        return {
            "version": VERSION,
            "channel":
                self.data.get("channel")
                or "—",
            "last_check_at":
                self.data.get(
                    "last_check_at"
                ),
            "last_check_error":
                self.data.get(
                    "last_check_error"
                ),
            "release_key_fingerprint":
                self.data.get(
                    "release_key_fingerprint"
                ),
            "components":
                list(
                    components.values()
                ),
            "releases":
                releases,
            "documentation":
                self.data.get(
                    "documentation",
                    [],
                ),
            "backups":
                self.data.get(
                    "backups",
                    [],
                ),
            "history":
                self.data.get(
                    "history",
                    [],
                ),
            "restart_required":
                bool(
                    self.data.get(
                        "restart_required"
                    )
                ),
            "pending_healthcheck":
                self.data.get(
                    "pending_healthcheck"
                )
                or {},
        }
