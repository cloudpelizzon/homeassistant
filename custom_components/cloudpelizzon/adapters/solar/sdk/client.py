"""Synchronous signed transport; HA callers must use an executor.



No module engine, package downloader, enrollment, activation, or device effects.

The caller owns the installation key; no credentials or capabilities are persisted.

"""

from datetime import datetime, timedelta, timezone

import hashlib

import http.client

import json

import re

import secrets

import ssl



from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey



HOST = "api.cloudpelizzon.com.br"

AUTHORITY = bytes.fromhex("3c6f1bfb75285e2077b95c421d18cf34c54d4714bce29e871f74e42b7d53e24b")

SKUS = frozenset({"CP-MAINTENANCE", "CP-SOLAR", "CP-SECURITY", "CP-AUTOMATION"})

ROUTES = frozenset(['/v1/automation/session', '/v1/automation/poll', '/v1/automation/authorize', '/v1/automation/effects', '/v1/automation/preview', '/v1/automation/run', '/v1/execute', '/v1/trial/activate', '/v1/trial/capability', '/v1/trial/status'])

TWO_PROOFS = frozenset({"automation.rules.create", "automation.rules.save", "automation.rules.validate", "automation.rules.activate"})

PURPOSE = {"status": b"CP-TRIAL-LIFECYCLE-V1\n", "capability": b"CP-TRIAL-CAP-REFRESH-V1\n"}





class ClientError(Exception):

    """Sanitized failure, without server bodies, tokens or key material."""





def canonical(value):

    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode()





def unique(pairs):

    result = {}

    for name, value in pairs:

        if name in result:

            raise ValueError("duplicate_field")

        result[name] = value

    return result





def https(path, body):

    if path not in ROUTES:

        raise ClientError("route_denied")

    raw = canonical(body)

    if len(raw) > 65536:

        raise ClientError("request_size")

    context = ssl.create_default_context()

    context.minimum_version = ssl.TLSVersion.TLSv1_2

    connection = http.client.HTTPSConnection(HOST, 443, context=context, timeout=45 if path in ("/v1/automation/preview","/v1/automation/run") else 10)

    try:

        connection.request("POST", path, raw, {"Content-Type": "application/json", "Accept": "application/json"})

        response = connection.getresponse()

        raw = response.read(65537)

        if len(raw) > 65536:

            raise ClientError("response_size")

        value = json.loads(raw, object_pairs_hook=unique, parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))

        if not isinstance(value, dict):

            raise ValueError()

        return response.status, value

    except ClientError:

        raise

    except Exception:

        raise ClientError("transport_failed") from None

    finally:

        connection.close()





def timestamp(value):

    result = datetime.fromisoformat(value.replace("Z", "+00:00"))

    if result.tzinfo is None:

        raise ValueError("timezone_required")

    return result.astimezone(timezone.utc)





class Client:

    def __init__(self, installation_id, private_key, *, transport=https, clock=None, authority=AUTHORITY):

        if not isinstance(installation_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{8,160}", installation_id):

            raise ClientError("installation_id_invalid")

        if not isinstance(private_key, Ed25519PrivateKey):

            raise ClientError("installation_key_invalid")

        self._iid = installation_id

        self._key = private_key

        self._authority = Ed25519PublicKey.from_public_bytes(authority)

        self._transport = transport

        self._clock = clock or (lambda: datetime.now(timezone.utc))



    def _sign(self, value, prefix=b"", field="request_signature"):

        return {**value, field: self._key.sign(prefix + canonical(value)).hex()}



    def _send(self, path, body):

        try:

            code, value = self._transport(path, body)

            if not isinstance(value, dict) or type(code) is not int:

                raise ClientError("response_invalid")

            if code != 200:

                raise ClientError("request_denied_http_" + str(code))

            return value

        except ClientError:

            raise

        except Exception:

            raise ClientError("transport_failed") from None



    def _control(self, action, extra=None):

        inner = self._sign({"installation_id": self._iid, "nonce": secrets.token_hex(32),

                            "timestamp": int(self._clock().timestamp()), **(extra or {})}, PURPOSE[action])

        outer = self._sign({"v": 1, "installation_id": self._iid, "action": action, "payload": inner,

                            "timestamp": int(self._clock().timestamp()), "nonce": secrets.token_hex(32)},

                           b"CP-GATEWAY-CONTROL-V1\n", "signature")

        return self._send("/v1/trial/" + action, outer), inner["nonce"]



    def activate(self,sku,*,confirmed=False):
        if confirmed is not True or type(sku) is not str or sku not in SKUS:
            raise ClientError('explicit_module_activation_required')
        preflight_request=self._sign({'installation_id':self._iid,'nonce':secrets.token_hex(32),
            'timestamp':int(self._clock().timestamp())},PURPOSE['status'])
        preflight=self._sign({'v':1,'installation_id':self._iid,'action':'status',
            'payload':preflight_request,'timestamp':int(self._clock().timestamp()),'nonce':secrets.token_hex(32)},
            b'CP-GATEWAY-CONTROL-V1\n','signature')
        request=self._sign({'installation_id':self._iid,'sku':sku,'nonce':secrets.token_hex(32),
            'timestamp':int(self._clock().timestamp())},b'CP-TRIAL-V2-START\n')
        envelope=self._sign({'v':1,'installation_id':self._iid,'action':'activate','payload':request,
            'preflight':preflight,'timestamp':int(self._clock().timestamp()),'nonce':secrets.token_hex(32)},
            b'CP-GATEWAY-CONTROL-V1\n','signature')
        packet=self._send('/v1/trial/activate',envelope)
        try:
            from .activation83 import verify_activation
            claim=verify_activation(packet,request,self._clock(),self._authority)
            return {'claims':claim,'first_activation':packet['first_activation']}
        except Exception:
            raise ClientError('activation_not_verified_refresh_status') from None

    def status(self):

        """Return verified display status; never use display state as an execution grant."""

        packet, nonce = self._control("status")

        try:

            if set(packet) != {"claims", "signature"}:

                raise ValueError()

            claim = packet["claims"]

            if (not isinstance(claim, dict) or set(claim) != {"schema", "installation_id", "nonce", "issued_at", "expires_at", "modules"}

                or claim["schema"] != "cp.r16.lifecycle.signed.v1" or claim["installation_id"] != self._iid or claim["nonce"] != nonce):

                raise ValueError()

            self._authority.verify(bytes.fromhex(packet["signature"]), canonical(claim))

            issued, expires, now = timestamp(claim["issued_at"]), timestamp(claim["expires_at"]), self._clock()

            if not (issued < expires <= issued + timedelta(seconds=5) and timedelta(seconds=-2) <= now - issued <= timedelta(seconds=5) and now < expires):

                raise ValueError()

            if not isinstance(claim["modules"], dict) or set(claim["modules"]) != SKUS:

                raise ValueError()

            for item in claim["modules"].values():

                if (not isinstance(item, dict) or set(item) != {"phase", "paid_confirmed", "blocks_at", "removal_due_at"}

                    or item["phase"] not in {"not_started", "not_entitled", "trial_active", "trial_blocked", "trial_removal_due", "licensed"}

                    or type(item["paid_confirmed"]) is not bool):

                    raise ValueError()

                for name in ("blocks_at", "removal_due_at"):

                    if item[name] is not None:

                        timestamp(item[name])

            return claim

        except Exception:

            raise ClientError("status_not_verified") from None



    def execute(self, sku, operation, args, *, request_id):

        return self._attempt(sku,operation,args,request_id=request_id)



    def preview(self,args,*,request_id):

        result=self._attempt('CP-AUTOMATION','automation.rules.execute',args,request_id=request_id,preview=True)

        if result.get('preview_only') is not True or result.get('physical_execution_authorized') is not False:

            raise ClientError('preview_response_invalid')

        return result



    def run_manual(self,args,*,request_id):
        result=self._attempt('CP-AUTOMATION','automation.rules.execute',args,request_id=request_id,channel='run')
        if (result.get('physical_execution_authorized') is not False or result.get('delivery_requires_fresh_signed_receipt') is not True
            or type(result.get('queued')) is not int or not 0<=result['queued']<=50):raise ClientError('manual_response_invalid')
        return result

    def worker_session(self,args,*,request_id):
        envelope=self._sign({'v':2,'installation_id':self._iid,'operation':'automation.worker.session',
            'args':json.loads(canonical(args)),'request_id':request_id,'proof':{},
            'timestamp':int(self._clock().timestamp()),'nonce':secrets.token_hex(32)},
            b'CP-GATEWAY-EXECUTE-V2\n','signature')
        value=self._send('/v1/automation/session',envelope)
        if value.get('ok') is not True or value.get('operation')!='automation.worker.session' or value.get('request_id')!=request_id or type(value.get('result')) is not dict:
            raise ClientError('worker_session_binding')
        return value['result']

    def worker_poll(self,args,*,request_id):
        return self._attempt('CP-AUTOMATION','automation.rules.execute',args,request_id=request_id,worker=True)

    def authorize_native(self,args,*,request_id):
        return self._attempt('CP-AUTOMATION','automation.rules.execute',args,request_id=request_id,native=True)

    def effects(self,args,*,request_id):
        return self._attempt('CP-AUTOMATION','automation.rules.execute',args,request_id=request_id,channel='effects')

    def _attempt(self, sku, operation, args, *, request_id, preview=False, channel=None, native=False, worker=False):

        """One attempt, fresh online grant; callers retain request_id for deliberate retries.



        A timeout is inconclusive: the operation may have committed. This client never

        automatically retries a mutation. No server-provided code or device action runs here.

        """

        if (not isinstance(sku, str) or sku not in SKUS or not isinstance(operation, str) or not re.fullmatch(r"[a-z][a-z0-9_.]{1,127}", operation)

            or not isinstance(args, dict) or not isinstance(request_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{16,128}", request_id)):

            raise ClientError("arguments_invalid")

        try:

            # Freeze nested mutable caller data before hashing/signing any request.

            frozen = json.loads(canonical(args), object_pairs_hook=unique)

            if len(canonical(frozen)) > 40000:

                raise ValueError()

        except Exception:

            raise ClientError("arguments_invalid") from None

        capability, _ = self._control("capability", {"sku": sku, "operation": operation})

        if (set(capability) != {"ok", "operation", "token"} or capability["ok"] is not True or capability["operation"] != operation

            or not isinstance(capability["token"], str) or not capability["token"].startswith("cpt1.") or len(capability["token"]) > 8192):

            raise ClientError("capability_invalid")

        binding = hashlib.sha256(canonical({"protocol": "cp.cloud.online.v1", "installation_id": self._iid,

                                           "sku": sku, "operation": operation, "args": frozen, "request_id": request_id})).hexdigest()

        bundle = preview or channel=='run' or operation in TWO_PROOFS

        proofs = [self._sign({"installation_id": self._iid, "sku": sku, "operation": operation,

                             "challenge": secrets.token_hex(32), "args_sha256": binding,

                             "token": capability["token"], "nonce": secrets.token_hex(32),

                             "timestamp": int(self._clock().timestamp())}) for _ in range(2 if bundle else 1)]

        if bundle and (proofs[0]["nonce"] == proofs[1]["nonce"] or proofs[0]["challenge"] == proofs[1]["challenge"]):

            raise ClientError("randomness_failure")

        envelope = {"v": 1 if preview or channel else 3 if bundle else 2, "installation_id": self._iid, "operation": operation, "args": frozen,

                    "request_id": request_id, "timestamp": int(self._clock().timestamp()), "nonce": secrets.token_hex(32)}

        envelope["proofs" if bundle else "proof"] = proofs if bundle else proofs[0]

        envelope = self._sign(envelope, b'CP-GATEWAY-RUN-V1\n' if channel=='run' else b'CP-GATEWAY-EFFECTS-V1\n' if channel=='effects' else b"CP-GATEWAY-PREVIEW-V1\n" if preview else b"CP-GATEWAY-EXECUTE-V3\n" if bundle else b"CP-GATEWAY-EXECUTE-V2\n", "signature")

        response = self._send("/v1/automation/poll" if worker else "/v1/automation/authorize" if native else "/v1/automation/"+channel if channel else "/v1/automation/preview" if preview else "/v1/execute", envelope)

        if (response.get("ok") is not True or response.get("operation") != operation or response.get("request_id") != request_id

            or not isinstance(response.get("result"), dict)):

            raise ClientError("execution_response_invalid")

        if native:
            try:
                from .native_wire85 import verify
                result=response['result']
                if set(result)!={'receipt'}:raise ValueError()
                verify(result['receipt'],self._iid,frozen,request_id,self._clock(),self._authority,proofs[0]['challenge'])
            except Exception:raise ClientError('native_receipt_not_verified') from None
        return response["result"]

