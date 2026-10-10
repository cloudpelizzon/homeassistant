"""Signed + online licensing for CloudPelizzon Core R5."""
from __future__ import annotations
from ..registry import module_installed

import asyncio
import base64
import hashlib
import hmac
import json
import time
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import (
    DEFAULT_CHECKIN_INTERVAL_SEC,
    DEFAULT_OFFLINE_GRACE_SEC,
    LICENSE_PUBLIC_E,
    LICENSE_PUBLIC_N,
    MODULES,
    ONLINE_LICENSE_REQUIRED,
    VERSION,
)

_SHA256_DER_PREFIX = bytes.fromhex("3031300d060960864801650304020105000420")
DENY_IMMEDIATELY = {"revoked", "expired", "invalid", "installation_mismatch", "not_registered"}
MIN_CHECKIN_GAP_SEC = 300
FORCED_CHECKIN_GAP_SEC = 10
MAX_BACKGROUND_CHECKIN_SEC = 300


def _b64url_decode(value: str) -> bytes:
    value += "=" * ((4 - len(value) % 4) % 4)
    return base64.urlsafe_b64decode(value.encode())


def _b64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode()


def _parse_dt(value: Any):
    if not value:
        return None
    try:
        text = str(value).replace("Z", "+00:00")
        dt = datetime.fromisoformat(text)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def _verify_signature(payload: bytes, signature: bytes) -> bool:
    k = (LICENSE_PUBLIC_N.bit_length() + 7) // 8
    if len(signature) != k:
        return False
    em = pow(int.from_bytes(signature, "big"), LICENSE_PUBLIC_E, LICENSE_PUBLIC_N).to_bytes(k, "big")
    digest_info = _SHA256_DER_PREFIX + hashlib.sha256(payload).digest()
    pad_len = k - len(digest_info) - 3
    if pad_len < 8:
        return False
    expected = b"\x00\x01" + (b"\xff" * pad_len) + b"\x00" + digest_info
    return hmac.compare_digest(em, expected)


def _decode_signed(token: str, allowed_prefixes: tuple[str, ...]) -> tuple[str, dict]:
    parts = str(token or "").strip().split(".")
    if len(parts) != 3 or parts[0] not in allowed_prefixes:
        raise ValueError("license_format_invalid")
    payload_raw = _b64url_decode(parts[1])
    signature = _b64url_decode(parts[2])
    if not _verify_signature(payload_raw, signature):
        raise ValueError("license_signature_invalid")
    try:
        payload = json.loads(payload_raw.decode("utf-8"))
    except Exception as err:
        raise ValueError("license_payload_invalid") from err
    if not isinstance(payload, dict):
        raise ValueError("license_payload_invalid")
    return parts[0], payload


class LicenseManager:
    def __init__(self, hass, store) -> None:
        self.hass = hass
        self.store = store
        self.data = store.data
        self._checkin_task: asyncio.Task | None = None
        self._stopped = False
        self._checkin_lock = asyncio.Lock()
        self._last_checkin_monotonic = 0.0

    @property
    def installation_id(self) -> str:
        return str(self.data.get("installation_id") or "")

    @property
    def server_url(self) -> str:
        return str(self.data.get("license_server_url") or "").rstrip("/")

    def decode_token(self, token: str) -> dict:
        _, payload = _decode_signed(token, ("CP1",))
        target = str(payload.get("installation_id") or "")
        if target not in (self.installation_id, "*"):
            raise ValueError("license_installation_mismatch")
        now = datetime.now(timezone.utc)
        not_before = _parse_dt(payload.get("not_before"))
        if not_before and now < not_before:
            raise ValueError("license_not_active_yet")
        expires = _parse_dt(payload.get("expires_at"))
        if expires and now > expires:
            raise ValueError("license_expired")
        modules = payload.get("modules")
        if not isinstance(modules, list) or not modules:
            raise ValueError("license_modules_missing")
        return payload

    def decode_lease(self, token: str) -> dict:
        _, payload = _decode_signed(token, ("CP2",))
        if str(payload.get("installation_id") or "") != self.installation_id:
            raise ValueError("lease_installation_mismatch")
        aid = str(self.data.get("activation_id") or "")
        if aid and str(payload.get("activation_id") or "") != aid:
            raise ValueError("lease_activation_mismatch")
        lid = str((self.data.get("license_payload") or {}).get("license_id") or "")
        if lid and str(payload.get("license_id") or "") != lid:
            raise ValueError("lease_license_mismatch")
        valid_until = _parse_dt(payload.get("valid_until"))
        if not valid_until or datetime.now(timezone.utc) > valid_until:
            raise ValueError("lease_expired")
        if not isinstance(payload.get("modules"), list):
            raise ValueError("lease_modules_missing")
        return payload

    async def _post_json(self, path: str, payload: dict) -> tuple[int, dict]:
        if not self.server_url:
            raise RuntimeError("license_server_not_configured")
        session = async_get_clientsession(self.hass)
        url = f"{self.server_url}/{path.lstrip('/')}"
        try:
            async with session.post(url, json=payload, timeout=20) as response:
                try:
                    body = await response.json(content_type=None)
                except Exception:
                    body = {"error": (await response.text())[:500]}
                return response.status, body if isinstance(body, dict) else {"data": body}
        except Exception as err:
            raise RuntimeError(f"license_server_unreachable:{type(err).__name__}") from err

    def _ha_version(self) -> str:
        try:
            from homeassistant.const import __version__ as ha_version
            return str(ha_version)
        except Exception:
            return ""

    async def async_activate(self, token: str) -> dict:
        # Validate locally before ever transmitting the signed token.
        payload = self.decode_token(token)
        if ONLINE_LICENSE_REQUIRED:
            status, online = await self._post_json("activate", {
                "token": str(token).strip(),
                "installation_id": self.installation_id,
                "installation_label": "CloudPelizzon Home Assistant",
                "core_version": VERSION,
                "ha_version": self._ha_version(),
            })
            if status != 200 or not online.get("ok") or online.get("status") != "active":
                reason = online.get("status") or online.get("error") or f"http_{status}"
                raise ValueError(f"online_activation_failed:{reason}")
            lease_payload = self.decode_lease_from_response(online)
            self.data.update({
                "license_token": str(online.get("cp1_token") or token).strip(),
                "license_payload": self.decode_token(str(online.get("cp1_token") or token)),
                "license_activated_at": datetime.now(timezone.utc).isoformat(),
                "activation_id": str(online.get("activation_id") or ""),
                "activation_secret": str(online.get("activation_secret") or ""),
                "lease_token": str(online.get("lease_token") or ""),
                "lease_payload": lease_payload,
                "license_revision": int(online.get("license_revision") or 1),
                "online_status": "active",
                "last_checkin_at": datetime.now(timezone.utc).isoformat(),
                "last_checkin_error": "",
                "checkin_interval_sec": int(online.get("checkin_interval_sec") or DEFAULT_CHECKIN_INTERVAL_SEC),
                "offline_grace_sec": int(online.get("offline_grace_sec") or DEFAULT_OFFLINE_GRACE_SEC),
            })
        else:
            self.data["license_token"] = str(token).strip()
            self.data["license_payload"] = payload
            self.data["license_activated_at"] = datetime.now(timezone.utc).isoformat()
            self.data["online_status"] = "local_only"
        await self.store.async_save()
        self.ensure_checkin_task()
        # A module denied at startup is not initialized merely by obtaining a
        # valid license. Resume its runtime without restarting Home Assistant.
        from .reactivation import schedule_reactivation_resume
        schedule_reactivation_resume(self.hass)
        return self.data.get("license_payload") or payload

    def decode_lease_from_response(self, online: dict) -> dict:
        token = str(online.get("lease_token") or "")
        if not token:
            raise ValueError("online_activation_missing_lease")
        # activation id is needed by decode_lease, but isn't stored yet during the
        # first activation, so validate signature+payload explicitly here.
        _, payload = _decode_signed(token, ("CP2",))
        if str(payload.get("installation_id") or "") != self.installation_id:
            raise ValueError("lease_installation_mismatch")
        if str(payload.get("activation_id") or "") != str(online.get("activation_id") or ""):
            raise ValueError("lease_activation_mismatch")
        valid_until = _parse_dt(payload.get("valid_until"))
        if not valid_until or datetime.now(timezone.utc) > valid_until:
            raise ValueError("lease_expired")
        return payload

    def _checkin_telemetry(self) -> dict:
        """Build privacy-minimized Control Center telemetry."""

        state = self.data.get("control_layer")

        if not isinstance(state, dict):
            state = {}

        module_state = state.get("modules")

        if not isinstance(module_state, dict):
            module_state = {}

        modules = []

        for sku in sorted(module_state):
            row = module_state.get(sku)

            if not isinstance(row, dict):
                continue

            modules.append({
                "sku": str(sku),
                "version": str(
                    row.get("version") or ""
                ),
                "installed": bool(
                    row.get("installed", False)
                ),
                "allowed": bool(
                    row.get("allowed", False)
                ),
                "effective_allowed": bool(
                    row.get(
                        "effective_allowed",
                        False,
                    )
                ),
                "status": str(
                    row.get("status") or ""
                ),
                "reason": str(
                    row.get("reason") or ""
                ),
            })

        return {
            "schema": "minimal-v2",
            "cloudpelizzon_version": str(
                state.get(
                    "cloudpelizzon_version"
                ) or ""
            ),
            "control_version": str(
                state.get("version") or ""
            ),
            "control_mode": str(
                state.get("mode") or "audit"
            ),
            "ha_version": self._ha_version(),
            "modules": modules,
        }


    async def async_checkin(
        self,
        *,
        force: bool = False,
    ) -> dict:
        """Run one authenticated check-in with concurrency protection."""

        async with self._checkin_lock:

            now_mono = time.monotonic()

            if (
                self._last_checkin_monotonic > 0
                and (
                    now_mono - self._last_checkin_monotonic
                ) < (FORCED_CHECKIN_GAP_SEC if force else MIN_CHECKIN_GAP_SEC)
            ):

                return {
                    "ok": True,
                    "status": str(
                        self.data.get(
                            "online_status"
                        )
                        or "active"
                    ),
                    "coalesced": True,
                    "reason":
                        "client_cooldown",
                    "cooldown_sec":
                        FORCED_CHECKIN_GAP_SEC if force else MIN_CHECKIN_GAP_SEC,
                }

            result = await self._async_checkin_network()

            if (
                isinstance(result, dict)
                and (
                    (
                        result.get("ok")
                        and str(result.get("status") or "") == "active"
                    )
                    or str(result.get("status") or "") in DENY_IMMEDIATELY
                )
            ):

                self._last_checkin_monotonic = (
                    time.monotonic()
                )

            # Only a fresh authenticated ACTIVE server response can resume
            # previously denied runtimes. Cached/coalesced checks must not.
            if (
                isinstance(result, dict)
                and result.get("ok") is True
                and str(result.get("status") or "") == "active"
            ):
                from .reactivation import schedule_reactivation_resume
                schedule_reactivation_resume(self.hass)

            return result

    async def _async_checkin_network(self) -> dict:
        aid = str(self.data.get("activation_id") or "")
        secret = str(self.data.get("activation_secret") or "")
        if not aid or not secret:
            return {"ok": False, "status": "activation_required"}
        ts = int(time.time())
        nonce = uuid4().hex

        telemetry = self._checkin_telemetry()

        telemetry_raw = json.dumps(
            telemetry,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")

        telemetry_sha256 = hashlib.sha256(
            telemetry_raw
        ).hexdigest()

        msg = (
            f"{aid}\n"
            f"{self.installation_id}\n"
            f"{ts}\n"
            f"{nonce}\n"
            f"{telemetry_sha256}"
        ).encode()

        signature = _b64url_encode(
            hmac.new(
                secret.encode(),
                msg,
                hashlib.sha256,
            ).digest()
        )

        try:
            status, result = await self._post_json(
                "checkin",
                {
                    "protocol": 2,
                    "activation_id": aid,
                    "installation_id": self.installation_id,
                    "timestamp": ts,
                    "nonce": nonce,
                    "telemetry": telemetry,
                    "telemetry_sha256": telemetry_sha256,
                    "signature": signature,
                    "core_version": VERSION,
                    "ha_version": self._ha_version(),
                },
            )
        except Exception as err:
            self.data["last_checkin_error"] = str(err)
            await self.store.async_save()
            return {"ok": False, "status": "server_unreachable", "error": str(err)}

        now_iso = datetime.now(timezone.utc).isoformat()
        server_status = str(result.get("status") or result.get("error") or f"http_{status}")
        self.data["last_checkin_at"] = now_iso
        self.data["last_checkin_error"] = "" if status == 200 else server_status
        self.data["online_status"] = server_status

        self.data["checkin_protocol"] = int(
            result.get("protocol") or 1
        )

        self.data["telemetry_accepted"] = bool(
            result.get(
                "telemetry_accepted",
                False,
            )
        )

        if status == 200 and result.get("ok") and server_status == "active":
            cp1 = str(result.get("cp1_token") or self.data.get("license_token") or "")
            if cp1:
                self.data["license_token"] = cp1
                self.data["license_payload"] = self.decode_token(cp1)
            lease_token = str(result.get("lease_token") or "")
            if lease_token:
                self.data["lease_token"] = lease_token
                self.data["lease_payload"] = self.decode_lease(lease_token)
            self.data["license_revision"] = int(result.get("license_revision") or self.data.get("license_revision") or 1)
            self.data["checkin_interval_sec"] = int(result.get("checkin_interval_sec") or self.data.get("checkin_interval_sec") or DEFAULT_CHECKIN_INTERVAL_SEC)
            self.data["offline_grace_sec"] = int(result.get("offline_grace_sec") or self.data.get("offline_grace_sec") or DEFAULT_OFFLINE_GRACE_SEC)
        elif server_status in DENY_IMMEDIATELY:
            # Keep the old lease for diagnostics, but entitlement is denied
            # immediately by _online_status when the authoritative server says so.
            pass

        await self.store.async_save()
        return result

    def _online_status(self, sku: str) -> dict:
        token = str(self.data.get("license_token") or "").strip()
        if not token:
            return {"allowed": False, "status": "locked", "reason": "license_missing", "sku": sku}
        try:
            cp1 = self.decode_token(token)
        except ValueError as err:
            return {"allowed": False, "status": "invalid", "reason": str(err), "sku": sku}

        modules_cp1 = {str(x) for x in cp1.get("modules", [])}
        if sku not in modules_cp1 and "*" not in modules_cp1:
            return {"allowed": False, "status": "not_entitled", "reason": "module_not_in_license", "sku": sku, "license_id": cp1.get("license_id"), "customer": cp1.get("customer")}

        if not ONLINE_LICENSE_REQUIRED:
            return {"allowed": True, "status": "licensed", "reason": None, "sku": sku, "license_id": cp1.get("license_id"), "customer": cp1.get("customer"), "expires_at": cp1.get("expires_at")}

        authoritative = str(self.data.get("online_status") or "")
        if authoritative in DENY_IMMEDIATELY:
            return {"allowed": False, "status": authoritative, "reason": f"server_{authoritative}", "sku": sku, "license_id": cp1.get("license_id"), "customer": cp1.get("customer")}

        if not self.data.get("activation_id"):
            return {"allowed": False, "status": "activation_required", "reason": "online_activation_required", "sku": sku, "license_id": cp1.get("license_id"), "customer": cp1.get("customer")}

        try:
            lease = self.decode_lease(str(self.data.get("lease_token") or ""))
        except ValueError as err:
            return {"allowed": False, "status": "lease_expired" if str(err) == "lease_expired" else "invalid", "reason": str(err), "sku": sku, "license_id": cp1.get("license_id"), "customer": cp1.get("customer")}

        modules = {str(x) for x in lease.get("modules", [])}
        allowed = sku in modules or "*" in modules
        if not allowed:
            return {"allowed": False, "status": "not_entitled", "reason": "module_not_in_lease", "sku": sku, "license_id": cp1.get("license_id"), "customer": cp1.get("customer")}
        return {
            "allowed": True,
            "status": "licensed",
            "reason": None,
            "sku": sku,
            "license_id": cp1.get("license_id"),
            "customer": cp1.get("customer"),
            "expires_at": cp1.get("expires_at"),
            "lease_valid_until": lease.get("valid_until"),
            "activation_id": self.data.get("activation_id"),
            "online": True,
        }

    async def async_status(self, sku: str, *, installed: bool = False) -> dict:
        # R5 intentionally has no automatic module trial fallback. Installed
        # commercial modules require a valid activated lease just like clients.
        return self._online_status(sku) if installed or sku in MODULES else {"allowed": False, "status": "locked", "reason": "not_installed", "sku": sku}

    def status_sync(self, sku: str, *, installed: bool = False) -> dict:
        return self._online_status(sku) if installed or sku in MODULES else {"allowed": False, "status": "locked", "reason": "not_installed", "sku": sku}

    def current_payload(self) -> dict | None:
        token = str(self.data.get("license_token") or "").strip()
        if not token:
            return None
        try:
            return self.decode_token(token)
        except ValueError:
            return None

    def diagnostics(self) -> dict:
        token = str(self.data.get("license_token") or "").strip()
        result = {
            "token_present": bool(token),
            "valid": False,
            "installation_match": False,
            "time_valid": False,
            "license_id": None,
            "customer": None,
            "expires_at": None,
            "modules": [],
            "activated_at": self.data.get("license_activated_at") or None,
            "activation_id": self.data.get("activation_id") or None,
            "online_status": self.data.get("online_status") or "not_activated",
            "server_url": self.server_url,
            "last_checkin_at": self.data.get("last_checkin_at") or None,
            "last_checkin_error": self.data.get("last_checkin_error") or None,
            "lease_valid_until": None,
            "lease_valid": False,
            "license_revision": self.data.get("license_revision") or 0,
            "error": None,
        }
        if not token:
            result["error"] = "license_missing"
            return result
        try:
            payload = self.decode_token(token)
            result.update({
                "valid": True,
                "installation_match": True,
                "time_valid": True,
                "license_id": payload.get("license_id"),
                "customer": payload.get("customer"),
                "expires_at": payload.get("expires_at"),
                "modules": payload.get("modules") or [],
            })
        except ValueError as err:
            result["error"] = str(err)
            return result
        try:
            lease = self.decode_lease(str(self.data.get("lease_token") or ""))
            result["lease_valid"] = True
            result["lease_valid_until"] = lease.get("valid_until")
        except ValueError as err:
            if result["error"] is None and self.data.get("activation_id"):
                result["error"] = str(err)
        return result

    async def async_clear(self) -> None:
        for key, value in {
            "license_token": "",
            "license_payload": {},
            "license_activated_at": "",
            "activation_id": "",
            "activation_secret": "",
            "lease_token": "",
            "lease_payload": {},
            "license_revision": 0,
            "online_status": "not_activated",
            "last_checkin_at": "",
            "last_checkin_error": "",
        }.items():
            self.data[key] = value
        await self.store.async_save()

    async def async_commercial_request(self, payload: dict) -> dict:
        data = {
            "name": str(payload.get("name") or "").strip(),
            "phone": str(payload.get("phone") or "").strip(),
            "email": str(payload.get("email") or "").strip(),
            "subject": str(payload.get("subject") or "").strip(),
            "message": str(payload.get("message") or "").strip(),
            "sku": str(payload.get("sku") or "").strip(),
            "installation_id": self.installation_id,
            "core_version": VERSION,
            "ha_version": self._ha_version(),
            "license_id": str((self.current_payload() or {}).get("license_id") or ""),
            "customer": str((self.current_payload() or {}).get("customer") or ""),
        }
        status, body = await self._post_json("commercial-request", data)
        if status not in (200, 201) or not body.get("ok"):
            reason = body.get("error") or body.get("detail") or f"http_{status}"
            raise RuntimeError(f"commercial_request_failed:{reason}")
        return body

    async def async_set_server_url(self, url: str) -> None:
        url = str(url or "").strip().rstrip("/")
        if not url.startswith(("https://", "http://")):
            raise ValueError("license_server_url_invalid")
        self.data["license_server_url"] = url
        await self.store.async_save()

    async def async_catalog(self, hass) -> list[dict]:
        rows = []
        for sku, meta in MODULES.items():
            installed = module_installed(hass, sku)
            status = await self.async_status(sku, installed=installed)
            rows.append({"sku": sku, **meta, "installed": installed, "license": status})
        return rows

    def ensure_checkin_task(self) -> None:
        if self._stopped or not self.data.get("activation_id"):
            return
        if self._checkin_task is None or self._checkin_task.done():
            self._checkin_task = self.hass.async_create_background_task(self._checkin_loop(), "cloudpelizzon-license-checkin")

    async def _checkin_loop(self) -> None:
        # small startup delay avoids fighting with HA initialization.
        await asyncio.sleep(30)
        while not self._stopped and self.data.get("activation_id"):
            try:
                await self.async_checkin()
            except asyncio.CancelledError:
                raise
            except Exception as err:
                self.data["last_checkin_error"] = f"background:{type(err).__name__}:{err}"
                await self.store.async_save()
            interval = max(60, min(MAX_BACKGROUND_CHECKIN_SEC, int(self.data.get("checkin_interval_sec") or DEFAULT_CHECKIN_INTERVAL_SEC)))
            await asyncio.sleep(interval)

    async def async_stop(self) -> None:
        self._stopped = True
        task = self._checkin_task
        if task and not task.done():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        self._checkin_task = None
