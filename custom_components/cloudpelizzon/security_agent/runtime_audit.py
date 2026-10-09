"""CloudPelizzon Protected Runtime Audit Client V2.6.

AUDIT / FAIL-OPEN / OBSERVE-ONLY.
No server-side secret is stored on Home Assistant.
"""

from __future__ import annotations

import base64
import hashlib
import json
import secrets
import time

from pathlib import Path

from aiohttp import ClientTimeout

from homeassistant.helpers.aiohttp_client import (
    async_get_clientsession,
)


GATEWAY = (
    "https://portal.cloudpelizzon.com.br"
    "/fleet-gateway"
)

OPERATION = "runtime.selftest"
MODULE = "CP-CORE"
SCOPE = "core.runtime.read"


def _canonical(value) -> bytes:

    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def _b64u(value: bytes) -> str:

    return (
        base64.urlsafe_b64encode(value)
        .rstrip(b"=")
        .decode("ascii")
    )


def _b64ud(value: str) -> bytes:

    value=str(value or "")

    value += (
        "="
        *
        (
            (4 - len(value) % 4)
            %
            4
        )
    )

    return base64.urlsafe_b64decode(
        value.encode("ascii")
    )


def _error(
    stage: str,
    reason: str,
    http_status=None,
) -> dict:

    result={
        "status":
            "audit_error",

        "mode":
            "AUDIT",

        "enforcement":
            False,

        "fail_open":
            True,

        "security_effect":
            "observe_only",

        "stage":
            stage,

        "reason":
            str(reason or "unknown")[:160],

        "identity_verified":
            False,

        "capability_verified":
            False,

        "runtime_verified":
            False,

        "operation":
            OPERATION,
    }

    if http_status is not None:
        result["http_status"]=http_status

    return result


async def _post(
    hass,
    endpoint: str,
    payload: dict,
) -> tuple[int, dict]:

    session=async_get_clientsession(hass)

    try:

        async with session.post(
            GATEWAY + endpoint,
            json=payload,
            timeout=ClientTimeout(total=15),
        ) as response:

            try:
                body=await response.json(
                    content_type=None
                )
            except Exception:
                body={
                    "ok": False,
                    "error": "invalid_json_response",
                }

            if not isinstance(body,dict):
                body={
                    "ok": False,
                    "error": "invalid_response_type",
                }

            return response.status,body

    except Exception as error:

        return (
            0,
            {
                "ok": False,
                "error": "gateway_unavailable",
                "error_type":
                    type(error).__name__,
            },
        )


async def async_runtime_audit_cycle(
    hass,
    *,
    security_dir: Path,
    installation_id,
    build_fingerprint,
    public_key_fingerprint,
    private_key_path: Path,
) -> dict:

    try:

        enrollment_path=(
            security_dir
            /
            "enrollment.json"
        )

        try:
            enrollment=json.loads(
                enrollment_path.read_text(
                    encoding="utf-8"
                )
            )
        except Exception:
            return _error(
                "precheck",
                "enrollment_unavailable",
            )


        if enrollment.get("status") != "verified":

            return _error(
                "precheck",
                "enrollment_not_verified",
            )


        installation_id=str(
            installation_id or ""
        ).strip()

        build_fingerprint=str(
            build_fingerprint or ""
        ).strip().lower()

        public_key_fingerprint=str(
            public_key_fingerprint or ""
        ).strip().lower()


        if (
            not installation_id
            or
            enrollment.get("installation_id")
            !=
            installation_id
        ):

            return _error(
                "precheck",
                "installation_identity_mismatch",
            )


        if (
            str(
                enrollment.get(
                    "build_fingerprint"
                )
                or ""
            ).lower()
            !=
            build_fingerprint
        ):

            return _error(
                "precheck",
                "official_build_mismatch",
            )


        if (
            str(
                enrollment.get(
                    "public_key_fingerprint"
                )
                or ""
            ).lower()
            !=
            public_key_fingerprint
        ):

            return _error(
                "precheck",
                "public_key_fingerprint_mismatch",
            )


        from cryptography.hazmat.primitives import (
            serialization,
        )


        private_key=(
            serialization
            .load_pem_private_key(
                Path(
                    private_key_path
                ).read_bytes(),
                password=None,
            )
        )


        derived_public=(
            private_key
            .public_key()
            .public_bytes(
                encoding=
                    serialization.Encoding.DER,

                format=
                    serialization.PublicFormat.SubjectPublicKeyInfo,
            )
        )


        derived_fp=hashlib.sha256(
            derived_public
        ).hexdigest()


        if derived_fp != public_key_fingerprint:

            return _error(
                "precheck",
                "private_key_fingerprint_mismatch",
            )


        #
        # 1. Identity challenge
        #
        status,challenge=await _post(
            hass,
            "/api/v1/runtime/challenge",
            {
                "installation_id":
                    installation_id,
            },
        )


        if (
            status < 200
            or
            status >= 300
            or
            not challenge.get("ok")
        ):

            return _error(
                "identity_challenge",
                challenge.get("error")
                or
                challenge.get("reason")
                or
                "challenge_failed",
                status,
            )


        challenge_id=str(
            challenge.get("challenge_id")
            or ""
        )

        signing_payload=str(
            challenge.get("signing_payload")
            or ""
        )


        if (
            not challenge_id
            or
            not signing_payload
        ):

            return _error(
                "identity_challenge",
                "challenge_payload_invalid",
            )


        signature=_b64u(
            private_key.sign(
                _b64ud(
                    signing_payload
                )
            )
        )


        #
        # 2. Identity assertion
        #
        status,proved=await _post(
            hass,
            "/api/v1/runtime/prove",
            {
                "installation_id":
                    installation_id,

                "challenge_id":
                    challenge_id,

                "signature":
                    signature,
            },
        )


        if (
            status < 200
            or
            status >= 300
            or
            not proved.get("ok")
        ):

            return _error(
                "identity_prove",
                proved.get("error")
                or
                proved.get("reason")
                or
                "identity_proof_failed",
                status,
            )


        assertion=str(
            proved.get(
                "identity_assertion"
            )
            or ""
        )


        if not assertion:

            return _error(
                "identity_prove",
                "identity_assertion_missing",
            )


        #
        # 3. Short-lived capability
        #
        status,issued=await _post(
            hass,
            "/api/v1/runtime/capability",
            {
                "installation_id":
                    installation_id,

                "identity_assertion":
                    assertion,
            },
        )


        if (
            status < 200
            or
            status >= 300
            or
            not issued.get("ok")
        ):

            return _error(
                "capability_issue",
                issued.get("error")
                or
                issued.get("reason")
                or
                "capability_issue_failed",
                status,
            )


        token=str(
            issued.get("token")
            or ""
        )

        capability=(
            issued.get("capability")
            or
            {}
        )

        capability_jti=str(
            capability.get("jti")
            or ""
        )


        if (
            not token
            or
            not capability_jti
        ):

            return _error(
                "capability_issue",
                "capability_payload_invalid",
            )


        if (
            capability.get("module")
            !=
            MODULE
            or
            SCOPE
            not in (
                capability.get("scopes")
                or
                []
            )
        ):

            return _error(
                "capability_issue",
                "capability_scope_invalid",
            )


        #
        # 4. Signed Runtime request
        #
        args={}

        request_hash=hashlib.sha256(
            _canonical(
                {
                    "operation": OPERATION,
                    "args": args,
                }
            )
        ).hexdigest()

        timestamp=int(time.time())
        nonce=secrets.token_urlsafe(24)


        proof_payload={
            "schema":
                "cloudpelizzon-runtime-request-v1",

            "capability_jti":
                capability_jti,

            "installation_id":
                installation_id,

            "module":
                MODULE,

            "scope":
                SCOPE,

            "operation":
                OPERATION,

            "timestamp":
                timestamp,

            "nonce":
                nonce,

            "request_hash":
                request_hash,
        }


        request_signature=_b64u(
            private_key.sign(
                _canonical(
                    proof_payload
                )
            )
        )


        status,runtime=await _post(
            hass,
            "/api/v1/runtime/execute",
            {
                "token":
                    token,

                "installation_id":
                    installation_id,

                "operation":
                    OPERATION,

                "args":
                    args,

                "timestamp":
                    timestamp,

                "nonce":
                    nonce,

                "request_hash":
                    request_hash,

                "request_signature":
                    request_signature,
            },
        )


        if (
            status < 200
            or
            status >= 300
            or
            not runtime.get("ok")
        ):

            return _error(
                "runtime_execute",
                runtime.get("error")
                or
                runtime.get("reason")
                or
                "runtime_execution_failed",
                status,
            )


        if runtime.get("operation") != OPERATION:

            return _error(
                "runtime_execute",
                "runtime_operation_mismatch",
            )


        return {
            "status":
                "audit_ready",

            "mode":
                "AUDIT",

            "enforcement":
                False,

            "fail_open":
                True,

            "security_effect":
                "observe_only",

            "identity_verified":
                True,

            "capability_verified":
                True,

            "runtime_verified":
                True,

            "operation":
                OPERATION,

            "execution_id":
                runtime.get(
                    "execution_id"
                ),

            "distribution_id":
                enrollment.get(
                    "distribution_id"
                ),

            "build_fingerprint":
                build_fingerprint,

            "private_key_local_only":
                True,
        }


    except Exception as error:

        return _error(
            "runtime_audit",
            type(error).__name__,
        )
