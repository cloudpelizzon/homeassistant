"""Public administrator entry point for signed Finance packages."""
import asyncio
import hashlib
import json
import platform
import secrets
import sysconfig
import time
from pathlib import Path

import probatio
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from homeassistant.components import websocket_api

from .compiled_activation627 import ActivationClient, HTTPSActivation, install, write
from .compiled_loader627 import canonical, safe
from .compiled_release628 import PUBLIC_KEY
from .finance_access653 import validate_finance_access

SKU = "CP-FINANCE"
RELEASE = "386d95b169c716121a75e237fcc64e69a2f8194c9b73a649c2dcf79086dded47"
COMMAND = "cloudpelizzon/finance/install"
HOST = "portal.cloudpelizzon.com.br"

def install_finance(root, context, mode):
    root = safe(root)
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    marker = safe(root / "installed627.json")
    identity = safe(root / "identity.json")
    key_path = safe(root / "installation.key")
    expected = {"core_id": context["core_id"], "installation_id": context["trial_id"]}
    if identity.exists():
        if json.loads(identity.read_bytes()) != expected:
            raise PermissionError("existing_identity_preserved")
    elif marker.exists() or key_path.exists():
        raise PermissionError("existing_identity_required")
    else:
        write(identity, canonical(expected))

    if not key_path.exists():
        if marker.exists():
            raise PermissionError("restore_existing_compiled_key")
        write(key_path, Ed25519PrivateKey.generate().private_bytes_raw())
    public = Ed25519PrivateKey.from_private_bytes(key_path.read_bytes()).public_key().public_bytes_raw().hex()
    native = context["client"]

    if mode == "paid":
        transport = HTTPSActivation(HOST, path="/custom/cloudpelizzon/compiled_activation628.php")
        delivered = ActivationClient(native, transport).request(
            SKU, read_operation="finance.state", public_key=public, manifest_sha256=RELEASE)
    else:
        # The authority starts or resumes the installation's Trial and returns the
        # matching package and offline entitlement in the same request.
        request = native._sign({
            "protocol": "cp.finance.trial-install.v1", "sku": SKU,
            "installation_id": context["trial_id"], "installation_public_key": public,
            "manifest_sha256": RELEASE, "abi": sysconfig.get_config_var("SOABI"),
            "architecture": platform.machine(), "nonce": secrets.token_hex(32),
            "timestamp": int(time.time()),
        })
        delivered = HTTPSActivation(HOST, path="/custom/cloudpelizzon/finance_trial661.php")(request)

    response = delivered["response"]
    manifest = response["package"]["manifest"]
    if hashlib.sha256(canonical(manifest)).hexdigest() != RELEASE:
        raise PermissionError("reviewed_native_release_required")
    claims = response["license"]["claims"]
    validate_finance_access(claims, int(time.time()))
    if claims["trial"] is not (mode == "trial"):
        raise PermissionError("unexpected_finance_edition")
    result = install(response, delivered["archive"], root=root, sku=SKU, public_key=PUBLIC_KEY,
                     core_id=context["core_id"], iid=context["trial_id"])
    return {**result, "trial": claims["trial"], "expires_at": claims["expires_at"]}

def register(hass, context):
    registry = hass.data.get(websocket_api.DOMAIN, {})
    if COMMAND in registry:
        raise RuntimeError("finance_installer_command_conflict")
    root = Path(hass.config.path(".storage/cloudpelizzon_compiled627"))
    lock = asyncio.Lock()
    closed = False

    async def authorized(connection, user):
        return (not closed and user is not None and connection.user is user
                and user.is_active and user.is_admin
                and await hass.auth.async_get_user(user.id) is user)

    @websocket_api.websocket_command({
        probatio.Required("type"): COMMAND,
        probatio.Required("mode"): probatio.In(("paid", "trial")),
        probatio.Required("confirmed"): bool,
    })
    @websocket_api.async_response
    async def dispatch(hass, connection, message):
        user = connection.user
        try:
            async with lock:
                if message["confirmed"] is not True or not await authorized(connection, user):
                    raise PermissionError("active_administrator_required")
                result = await hass.async_add_executor_job(install_finance, root, context, message["mode"])
                if not await authorized(connection, user):
                    raise PermissionError("active_administrator_required")
        except asyncio.CancelledError:
            raise
        except Exception:
            connection.send_error(message["id"], "finance_installation_unavailable",
                                  "Confira a licença ou a disponibilidade do Trial desta instalação.")
        else:
            connection.send_result(message["id"], result)

    websocket_api.async_register_command(hass, dispatch)

    def close():
        nonlocal closed
        closed = True
        registry = hass.data.get(websocket_api.DOMAIN, {})
        if COMMAND in registry and registry[COMMAND][0] is dispatch:
            registry.pop(COMMAND)

    return close
