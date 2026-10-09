"""CloudPelizzon Secure Enrollment Client V2.5B.

AUDIT / FAIL-OPEN.

The installation private key never leaves Home Assistant.
No issuer, portal, admin or runtime credential is stored here.
"""

from __future__ import annotations

import base64
import json
import os

from datetime import (
    datetime,
    timezone,
)

from pathlib import Path

from urllib.parse import (
    urlsplit,
)

from aiohttp import (
    ClientTimeout,
)

from homeassistant.helpers.aiohttp_client import (
    async_get_clientsession,
)

from cryptography.hazmat.primitives import (
    serialization,
)

from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
)


ENROLLMENT_CLIENT_VERSION = "2.5B"


def _now_iso() -> str:

    return (
        datetime.now(
            timezone.utc
        )
        .replace(
            microsecond=0
        )
        .isoformat()
    )


def _load_json(
    path: Path,
) -> dict:

    try:

        data=json.loads(
            path.read_text(
                encoding="utf-8"
            )
        )

        if isinstance(
            data,
            dict,
        ):
            return data

    except Exception:
        pass

    return {}


def _write_json(
    path: Path,
    data: dict,
) -> None:

    path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    temp=path.with_name(
        path.name
        +
        ".tmp"
    )

    payload=(
        json.dumps(
            data,
            ensure_ascii=False,
            sort_keys=True,
            indent=2,
        )
        +
        "\n"
    ).encode(
        "utf-8"
    )

    with temp.open(
        "wb"
    ) as handle:

        handle.write(
            payload
        )

        handle.flush()

        os.fsync(
            handle.fileno()
        )

    os.chmod(
        temp,
        0o600,
    )

    temp.replace(
        path
    )

    os.chmod(
        path,
        0o600,
    )


def _gateway_url(
    server_url: str,
) -> str:

    parsed=urlsplit(
        server_url
    )

    if (
        parsed.scheme
        not in (
            "http",
            "https",
        )
        or
        not parsed.netloc
    ):
        raise ValueError(
            "license_server_url_invalid"
        )

    return (
        f"{parsed.scheme}://"
        f"{parsed.netloc}"
        "/fleet-gateway"
    )


def _error_value(
    body,
) -> str:

    if isinstance(
        body,
        dict,
    ):

        value=(
            body.get(
                "error"
            )
            or
            body.get(
                "detail"
            )
            or
            "remote_error"
        )

        return str(
            value
        )[:240]

    return "remote_error"


async def _post_json(
    hass,
    url: str,
    payload: dict,
):

    session=async_get_clientsession(
        hass
    )

    timeout=ClientTimeout(
        total=30
    )

    async with session.post(
        url,
        json=payload,
        headers={
            "Accept":
                "application/json",
        },
        timeout=timeout,
    ) as response:

        raw=await response.text()

        try:

            body=json.loads(
                raw
            )

        except Exception:

            body={
                "error":
                    "non_json_response",
            }

        return (
            response.status,
            body,
        )


def _b64u_decode(
    value: str,
) -> bytes:

    value=str(
        value
        or ""
    ).strip()

    value += (
        "="
        *
        (
            (
                4
                -
                len(
                    value
                )
                % 4
            )
            % 4
        )
    )

    return (
        base64
        .urlsafe_b64decode(
            value.encode(
                "ascii"
            )
        )
    )


def _b64u_encode(
    value: bytes,
) -> str:

    return (
        base64
        .urlsafe_b64encode(
            value
        )
        .decode(
            "ascii"
        )
        .rstrip(
            "="
        )
    )


def _sign_payload(
    private_key_path: str,
    signing_payload: str,
) -> str:

    private_key=(
        serialization
        .load_pem_private_key(
            Path(
                private_key_path
            ).read_bytes(),
            password=None,
        )
    )

    if not isinstance(
        private_key,
        Ed25519PrivateKey,
    ):

        raise RuntimeError(
            "installation_private_key_not_ed25519"
        )

    signature=private_key.sign(
        _b64u_decode(
            signing_payload
        )
    )

    return _b64u_encode(
        signature
    )


async def async_enrollment_cycle(
    hass,
    *,
    security_dir: Path,
    installation_id,
    server_url,
    build_fingerprint,
    public_key_fingerprint,
    private_key_path,
    public_key_path,
) -> dict:

    installation_id=str(
        installation_id
        or ""
    ).strip()

    server_url=str(
        server_url
        or ""
    ).strip()

    build_fingerprint=str(
        build_fingerprint
        or ""
    ).strip().lower()

    public_key_fingerprint=str(
        public_key_fingerprint
        or ""
    ).strip().lower()

    enrollment_path=(
        security_dir
        /
        "enrollment.json"
    )

    pending_path=(
        security_dir
        /
        "enrollment_pending.json"
    )

    bundle_path=(
        security_dir
        /
        "enrollment_bundle.json"
    )


    existing=_load_json(
        enrollment_path
    )


    if (
        existing.get(
            "status"
        )
        ==
        "verified"
    ):

        if (
            existing.get(
                "installation_id"
            )
            ==
            installation_id
            and
            existing.get(
                "build_fingerprint"
            )
            ==
            build_fingerprint
            and
            existing.get(
                "public_key_fingerprint"
            )
            ==
            public_key_fingerprint
        ):

            return existing


        return {
            "status":
                "local_enrollment_mismatch",

            "enrollment_version":
                ENROLLMENT_CLIENT_VERSION,
        }


    if (
        not installation_id
        or
        not server_url
    ):

        return {
            "status":
                "pending_secure_enrollment_bridge",

            "reason":
                "license_context_not_ready",

            "enrollment_version":
                ENROLLMENT_CLIENT_VERSION,
        }


    gateway=_gateway_url(
        server_url
    )


    pending=_load_json(
        pending_path
    )


    if not pending:

        bundle=_load_json(
            bundle_path
        )


        if not bundle:

            return {
                "status":
                    "pending_secure_enrollment_bridge",

                "enrollment_version":
                    ENROLLMENT_CLIENT_VERSION,

                "gateway":
                    gateway,
            }


        for key,actual in (
            (
                "installation_id",
                installation_id,
            ),
            (
                "build_fingerprint",
                build_fingerprint,
            ),
            (
                "public_key_fingerprint",
                public_key_fingerprint,
            ),
        ):

            expected=str(
                bundle.get(
                    key
                )
                or ""
            ).strip().lower()

            compare=str(
                actual
                or ""
            ).strip().lower()


            if (
                expected
                and
                expected
                !=
                compare
            ):

                return {
                    "status":
                        "enrollment_bundle_mismatch",

                    "field":
                        key,

                    "enrollment_version":
                        ENROLLMENT_CLIENT_VERSION,
                }


        enrollment_token=str(
            bundle.get(
                "enrollment_token"
            )
            or ""
        ).strip()


        if not enrollment_token:

            return {
                "status":
                    "enrollment_bundle_invalid",

                "reason":
                    "enrollment_token_missing",

                "enrollment_version":
                    ENROLLMENT_CLIENT_VERSION,
            }


        public_key_pem=(
            Path(
                public_key_path
            )
            .read_text(
                encoding="utf-8"
            )
        )


        status,body=await _post_json(
            hass,
            gateway
            +
            "/api/v1/enrollment/consume",

            {
                "enrollment_token":
                    enrollment_token,

                "installation_id":
                    installation_id,

                "build_fingerprint":
                    build_fingerprint,

                "public_key":
                    public_key_pem,
            },
        )


        if (
            status != 200
            or
            body.get(
                "status"
            )
            !=
            "identity_enrolled"
        ):

            return {
                "status":
                    "enrollment_error",

                "stage":
                    "consume",

                "http_status":
                    status,

                "error":
                    _error_value(
                        body
                    ),

                "enrollment_version":
                    ENROLLMENT_CLIENT_VERSION,
            }


        proof_ticket=str(
            body.get(
                "proof_ticket"
            )
            or ""
        ).strip()


        if not proof_ticket:

            return {
                "status":
                    "enrollment_error",

                "stage":
                    "consume",

                "error":
                    "proof_ticket_missing",

                "enrollment_version":
                    ENROLLMENT_CLIENT_VERSION,
            }


        pending={
            "schema":
                "cloudpelizzon-enrollment-pending-v1",

            "enrollment_version":
                ENROLLMENT_CLIENT_VERSION,

            "installation_id":
                installation_id,

            "distribution_id":
                (
                    body.get(
                        "distribution_id"
                    )
                    or
                    bundle.get(
                        "distribution_id"
                    )
                ),

            "release_id":
                bundle.get(
                    "release_id"
                ),

            "token_id":
                bundle.get(
                    "token_id"
                ),

            "build_fingerprint":
                build_fingerprint,

            "public_key_fingerprint":
                public_key_fingerprint,

            "proof_ticket":
                proof_ticket,

            "gateway":
                gateway,

            "consumed_at":
                _now_iso(),
        }


        _write_json(
            pending_path,
            pending,
        )


        try:
            bundle_path.unlink()
        except FileNotFoundError:
            pass


    proof_ticket=str(
        pending.get(
            "proof_ticket"
        )
        or ""
    ).strip()


    if not proof_ticket:

        return {
            "status":
                "enrollment_error",

            "stage":
                "pending",

            "error":
                "proof_ticket_missing",

            "enrollment_version":
                ENROLLMENT_CLIENT_VERSION,
        }


    status,challenge=await _post_json(
        hass,
        gateway
        +
        "/api/v1/enrollment/challenge",

        {
            "proof_ticket":
                proof_ticket,

            "installation_id":
                installation_id,
        },
    )


    if status != 200:

        return {
            "status":
                "enrollment_error",

            "stage":
                "challenge",

            "http_status":
                status,

            "error":
                _error_value(
                    challenge
                ),

            "enrollment_version":
                ENROLLMENT_CLIENT_VERSION,
        }


    challenge_id=str(
        challenge.get(
            "challenge_id"
        )
        or ""
    ).strip()

    signing_payload=str(
        challenge.get(
            "signing_payload"
        )
        or ""
    ).strip()


    if (
        not challenge_id
        or
        not signing_payload
    ):

        return {
            "status":
                "enrollment_error",

            "stage":
                "challenge",

            "error":
                "challenge_payload_invalid",

            "enrollment_version":
                ENROLLMENT_CLIENT_VERSION,
        }


    signature=_sign_payload(
        private_key_path,
        signing_payload,
    )


    status,proved=await _post_json(
        hass,
        gateway
        +
        "/api/v1/enrollment/prove",

        {
            "proof_ticket":
                proof_ticket,

            "installation_id":
                installation_id,

            "challenge_id":
                challenge_id,

            "signature":
                signature,
        },
    )


    if (
        status != 200
        or
        proved.get(
            "enrollment_status"
        )
        !=
        "identity_verified"
    ):

        return {
            "status":
                "enrollment_error",

            "stage":
                "prove",

            "http_status":
                status,

            "error":
                _error_value(
                    proved
                ),

            "enrollment_version":
                ENROLLMENT_CLIENT_VERSION,
        }


    result={
        "schema":
            "cloudpelizzon-enrollment-v1",

        "enrollment_version":
            ENROLLMENT_CLIENT_VERSION,

        "status":
            "verified",

        "enrollment_status":
            "identity_verified",

        "installation_id":
            installation_id,

        "distribution_id":
            (
                proved.get(
                    "distribution_id"
                )
                or
                pending.get(
                    "distribution_id"
                )
            ),

        "release_id":
            pending.get(
                "release_id"
            ),

        "build_fingerprint":
            build_fingerprint,

        "public_key_fingerprint":
            public_key_fingerprint,

        "private_key_local_only":
            True,

        "gateway":
            gateway,

        "verified_at":
            _now_iso(),
    }


    _write_json(
        enrollment_path,
        result,
    )


    try:
        pending_path.unlink()
    except FileNotFoundError:
        pass


    return result
