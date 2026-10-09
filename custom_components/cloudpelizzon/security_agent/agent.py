"""CloudPelizzon HA Security Agent V2.4.

AUDIT MODE ONLY.

No entitlement is blocked here.
No module is disabled here.
No server secret is stored here.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os

from datetime import (
    datetime,
    timezone,
)

from pathlib import Path


DOMAIN = "cloudpelizzon"

AGENT_VERSION = "2.6.0-audit"

AUDIT_INTERVAL_SEC = 900

RETRY_INTERVAL_SEC = 60


_LOGGER = logging.getLogger(
    __name__
)


def _cppriv_now_iso() -> str:

    return (
        datetime.now(
            timezone.utc
        )
        .replace(
            microsecond=0
        )
        .isoformat()
    )



def _cppriv_atomic_write_bytes(
    path: Path,
    data: bytes,
    mode: int,
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


    with temp.open(
        "wb"
    ) as handle:

        handle.write(
            data
        )

        handle.flush()

        os.fsync(
            handle.fileno()
        )


    os.chmod(
        temp,
        mode,
    )


    temp.replace(
        path
    )


    os.chmod(
        path,
        mode,
    )



def _cppriv_atomic_write_json(
    path: Path,
    data: dict,
) -> None:

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


    _cppriv_atomic_write_bytes(
        path,
        payload,
        0o600,
    )



def _cppriv_load_json(
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



def _cppriv_ensure_identity(
    security_dir: Path,
) -> dict:

    #
    # Import occurs only inside the optional Agent.
    #
    # If cryptography is unavailable, the Agent degrades
    # without affecting CloudPelizzon startup.
    #
    from cryptography.hazmat.primitives import (
        serialization,
    )

    from cryptography.hazmat.primitives.asymmetric.ed25519 import (
        Ed25519PrivateKey,
    )


    security_dir.mkdir(
        parents=True,
        exist_ok=True,
    )


    os.chmod(
        security_dir,
        0o700,
    )


    private_path=(
        security_dir
        /
        "installation_private.pem"
    )


    public_path=(
        security_dir
        /
        "installation_public.pem"
    )


    identity_path=(
        security_dir
        /
        "identity.json"
    )


    created=False


    if private_path.exists():

        private_key=(
            serialization.load_pem_private_key(
                private_path.read_bytes(),
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


        os.chmod(
            private_path,
            0o600,
        )


    else:

        if public_path.exists():

            raise RuntimeError(
                "public_key_exists_without_private_key"
            )


        private_key=(
            Ed25519PrivateKey.generate()
        )


        private_pem=(
            private_key.private_bytes(
                encoding=
                    serialization.Encoding.PEM,

                format=
                    serialization.PrivateFormat.PKCS8,

                encryption_algorithm=
                    serialization.NoEncryption(),
            )
        )


        _cppriv_atomic_write_bytes(
            private_path,
            private_pem,
            0o600,
        )


        created=True


    public_key=(
        private_key.public_key()
    )


    public_pem=(
        public_key.public_bytes(
            encoding=
                serialization.Encoding.PEM,

            format=
                serialization.PublicFormat.SubjectPublicKeyInfo,
        )
    )


    public_der=(
        public_key.public_bytes(
            encoding=
                serialization.Encoding.DER,

            format=
                serialization.PublicFormat.SubjectPublicKeyInfo,
        )
    )


    fingerprint=(
        hashlib.sha256(
            public_der
        )
        .hexdigest()
    )


    if public_path.exists():

        existing_public=(
            public_path.read_bytes()
        )


        if (
            existing_public
            !=
            public_pem
        ):

            raise RuntimeError(
                "installation_public_key_mismatch"
            )


    else:

        _cppriv_atomic_write_bytes(
            public_path,
            public_pem,
            0o644,
        )


    os.chmod(
        public_path,
        0o644,
    )


    old_identity=(
        _cppriv_load_json(
            identity_path
        )
    )


    created_at=(
        old_identity.get(
            "created_at"
        )
        or
        _cppriv_now_iso()
    )


    metadata={
        "schema":
            "cloudpelizzon-ha-identity-v1",

        "agent_version":
            AGENT_VERSION,

        "algorithm":
            "Ed25519",

        "public_key_fingerprint":
            fingerprint,

        "private_key_local_only":
            True,

        "created_at":
            created_at,

        "updated_at":
            _cppriv_now_iso(),
    }


    _cppriv_atomic_write_json(
        identity_path,
        metadata,
    )


    return {
        "ready":
            True,

        "created":
            created,

        "algorithm":
            "Ed25519",

        "public_key_fingerprint":
            fingerprint,

        "private_key_path":
            str(
                private_path
            ),

        "public_key_path":
            str(
                public_path
            ),

        "identity_path":
            str(
                identity_path
            ),
    }



def _cppriv_build_fingerprint(
    integration_root: Path,
) -> dict:

    digest=hashlib.sha256()

    file_count=0

    byte_count=0


    for path in sorted(
        integration_root.rglob(
            "*"
        )
    ):

        if not path.is_file():

            continue


        relative=path.relative_to(
            integration_root
        )


        if (
            "__pycache__"
            in relative.parts
        ):

            continue


        if path.suffix.lower() in {
            ".pyc",
            ".pyo",
        }:

            continue


        file_hash=hashlib.sha256()

        size=0


        with path.open(
            "rb"
        ) as handle:

            while True:

                block=handle.read(
                    1024 * 1024
                )


                if not block:

                    break


                file_hash.update(
                    block
                )

                size += len(
                    block
                )


        digest.update(
            relative.as_posix().encode(
                "utf-8"
            )
        )


        digest.update(
            b"\0"
        )


        digest.update(
            file_hash.hexdigest().encode(
                "ascii"
            )
        )


        digest.update(
            b"\n"
        )


        file_count += 1

        byte_count += size


    return {
        "fingerprint":
            digest.hexdigest(),

        "files":
            file_count,

        "bytes":
            byte_count,
    }



def _cppriv_find_license_manager(
    value,
    depth: int = 0,
    seen: set[int] | None = None,
):

    if seen is None:

        seen=set()


    if depth > 4:

        return None


    obj_id=id(
        value
    )


    if obj_id in seen:

        return None


    seen.add(
        obj_id
    )


    if (
        hasattr(
            value,
            "installation_id",
        )
        and
        (
            hasattr(
                value,
                "diagnostics",
            )
            or
            hasattr(
                value,
                "server_url",
            )
        )
    ):

        return value


    if isinstance(
        value,
        dict,
    ):

        #
        # Prefer a conventional runtime license_manager.
        #
        direct=value.get(
            "license_manager"
        )


        if direct is not None:

            result=(
                _cppriv_find_license_manager(
                    direct,
                    depth + 1,
                    seen,
                )
            )


            if result is not None:

                return result


        for child in value.values():

            result=(
                _cppriv_find_license_manager(
                    child,
                    depth + 1,
                    seen,
                )
            )


            if result is not None:

                return result


    return None



def _cppriv_license_context(
    hass,
) -> dict:

    platform=hass.data.get(
        DOMAIN,
        {},
    )


    manager=(
        _cppriv_find_license_manager(
            platform
        )
    )


    if manager is None:

        return {
            "available":
                False,

            "installation_id":
                None,

            "server_url":
                None,

            "online_status":
                None,

            "reason":
                "license_manager_not_ready",
        }


    installation_id=str(
        getattr(
            manager,
            "installation_id",
            "",
        )
        or ""
    )


    server_url=str(
        getattr(
            manager,
            "server_url",
            "",
        )
        or ""
    )


    safe_diagnostics={}


    try:

        diagnostics=manager.diagnostics()


        if isinstance(
            diagnostics,
            dict,
        ):

            for key in (
                "online_status",
                "license_id",
                "activation_id",
                "lease_valid_until",
                "last_checkin_at",
                "license_revision",
            ):

                if key in diagnostics:

                    safe_diagnostics[
                        key
                    ]=diagnostics[
                        key
                    ]


    except Exception:

        safe_diagnostics={
            "diagnostics_error":
                True,
        }


    return {
        "available":
            bool(
                installation_id
            ),

        "installation_id":
            installation_id
            or
            None,

        "server_url":
            server_url
            or
            None,

        "online_status":
            safe_diagnostics.get(
                "online_status"
            ),

        "diagnostics":
            safe_diagnostics,
    }



def _cppriv_local_audit(
    integration_root: Path,
    security_dir: Path,
) -> dict:

    identity=(
        _cppriv_ensure_identity(
            security_dir
        )
    )


    build=(
        _cppriv_build_fingerprint(
            integration_root
        )
    )


    return {
        "identity":
            identity,

        "build":
            build,
    }



def _cppriv_write_audit_state(
    security_dir: Path,
    state: dict,
) -> None:

    _cppriv_atomic_write_json(
        security_dir
        /
        "audit_state.json",
        state,
    )



async def async_start(
    hass,
    entry,
) -> None:

    platform=hass.data.setdefault(
        DOMAIN,
        {},
    )


    security_dir=Path(
        hass.config.path(
            ".cloudpelizzon",
            "security",
        )
    )


    integration_root=Path(
        __file__
    ).resolve().parents[1]



    # CP-SECURITY V2.5B - enrollment bridge
    from . import enrollment as _cppriv_enrollment
    from . import runtime_audit as _cppriv_runtime_audit

    first_cycle=True


    while True:

        try:

            local=await (
                hass.async_add_executor_job(
                    _cppriv_local_audit,
                    integration_root,
                    security_dir,
                )
            )


            license_context=(
                _cppriv_license_context(
                    hass
                )
            )



            enrollment=await (
                _cppriv_enrollment.async_enrollment_cycle(
                    hass,
                    security_dir=security_dir,
                    installation_id=license_context.get(
                        "installation_id"
                    ),
                    server_url=license_context.get(
                        "server_url"
                    ),
                    build_fingerprint=local[
                        "build"
                    ][
                        "fingerprint"
                    ],
                    public_key_fingerprint=local[
                        "identity"
                    ][
                        "public_key_fingerprint"
                    ],
                    private_key_path=local[
                        "identity"
                    ][
                        "private_key_path"
                    ],
                    public_key_path=local[
                        "identity"
                    ][
                        "public_key_path"
                    ],
                )
            )

            runtime_audit=await (
                _cppriv_runtime_audit.async_runtime_audit_cycle(
                    hass,
                    security_dir=security_dir,
                    installation_id=license_context.get(
                        "installation_id"
                    ),
                    build_fingerprint=local[
                        "build"
                    ][
                        "fingerprint"
                    ],
                    public_key_fingerprint=local[
                        "identity"
                    ][
                        "public_key_fingerprint"
                    ],
                    private_key_path=local[
                        "identity"
                    ][
                        "private_key_path"
                    ],
                )
            )

            state={
                "schema":
                    "cloudpelizzon-security-agent-state-v1",

                "agent_version":
                    AGENT_VERSION,

                "mode":
                    "AUDIT",

                "enforcement":
                    False,

                "fail_open":
                    True,

                "timestamp":
                    _cppriv_now_iso(),

                "config_entry_id":
                    entry.entry_id,

                "identity":
                    {
                        "ready":
                            local[
                                "identity"
                            ][
                                "ready"
                            ],

                        "algorithm":
                            local[
                                "identity"
                            ][
                                "algorithm"
                            ],

                        "public_key_fingerprint":
                            local[
                                "identity"
                            ][
                                "public_key_fingerprint"
                            ],

                        "private_key_local_only":
                            True,
                    },

                "build":
                    local[
                        "build"
                    ],

                "license":
                    license_context,

                #
                # Deliberately NOT enrolled yet.
                #
                # The HA must never receive issuer/admin/runtime tokens.
                #
                "distribution":
                    {
                        "status":
                            "pending_secure_enrollment_bridge",
                    },

                "server_identity":
                    {
                        "status":
                            "pending_secure_enrollment_bridge",
                    },

                "protected_runtime":
                    {
                        "status":
                            "not_enforced",
                    },

                "security_effect":
                    "observe_only",
            }



            #
            # V2.6 Protected Runtime result - AUDIT only.
            state["protected_runtime"]=runtime_audit

            # V2.5B enrollment is informational only.
            # It never enables enforcement.
            #
            state[
                "enrollment"
            ]=enrollment


            if (
                enrollment.get(
                    "status"
                )
                ==
                "verified"
            ):

                state[
                    "distribution"
                ]={
                    "status":
                        "verified",

                    "distribution_id":
                        enrollment.get(
                            "distribution_id"
                        ),

                    "release_id":
                        enrollment.get(
                            "release_id"
                        ),

                    "build_fingerprint":
                        enrollment.get(
                            "build_fingerprint"
                        ),
                }


                state[
                    "server_identity"
                ]={
                    "status":
                        "verified",

                    "installation_id":
                        enrollment.get(
                            "installation_id"
                        ),

                    "public_key_fingerprint":
                        enrollment.get(
                            "public_key_fingerprint"
                        ),
                }

            await hass.async_add_executor_job(
                _cppriv_write_audit_state,
                security_dir,
                state,
            )


            platform[
                "security_agent"
            ]=state


            platform[
                "security_agent_state"
            ]="audit_ready"


            if first_cycle:

                _LOGGER.info(
                    "CloudPelizzon Security Agent %s active in AUDIT mode; "
                    "identity=%s build=%s",
                    AGENT_VERSION,
                    (
                        local[
                            "identity"
                        ][
                            "public_key_fingerprint"
                        ][:16]
                        +
                        "..."
                    ),
                    (
                        local[
                            "build"
                        ][
                            "fingerprint"
                        ][:16]
                        +
                        "..."
                    ),
                )


                first_cycle=False


            await asyncio.sleep(
                AUDIT_INTERVAL_SEC
            )


        except asyncio.CancelledError:

            platform[
                "security_agent_state"
            ]="stopped"

            raise


        except Exception as error:

            platform[
                "security_agent_state"
            ]="audit_degraded"


            platform[
                "security_agent"
            ]={
                "agent_version":
                    AGENT_VERSION,

                "mode":
                    "AUDIT",

                "enforcement":
                    False,

                "fail_open":
                    True,

                "timestamp":
                    _cppriv_now_iso(),

                "status":
                    "degraded",

                "error_type":
                    type(
                        error
                    ).__name__,

                "error":
                    str(
                        error
                    )[:500],
            }


            _LOGGER.warning(
                "CloudPelizzon Security Agent AUDIT degraded: %s: %s",
                type(
                    error
                ).__name__,
                error,
            )


            #
            # CRITICAL:
            # Agent failure never aborts CloudPelizzon.
            #
            await asyncio.sleep(
                RETRY_INTERVAL_SEC
            )



async def async_stop(
    hass,
    entry,
) -> None:

    platform=hass.data.get(
        DOMAIN,
        {},
    )


    if isinstance(
        platform,
        dict,
    ):

        platform[
            "security_agent_state"
        ]="stopped"
