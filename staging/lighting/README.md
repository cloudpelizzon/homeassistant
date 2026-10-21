# CP-LIGHTING native transport candidate

Ported selectively from PR #3 commit c18be8cc975204c9be1a57583604d35ac05bc13c onto PR #4 commit 6d447ae79bdf5bb1749c67d8535bec19fffcf694.

These inactive adapters provide native HA session and entity ACL validation, configuration projection, and inventory batches bound to actor, installation and request. No runtime imports or registers them. They contain no commercial authority, signer, private engine or frontend assets.

Registration requires the private signed port and independently verified inventory receipts. The private gateway remains responsible for two independent proofs, single-use nonces, SKU readiness, seven-day Trial enforcement and authorization before commit. Synthetic tests do not establish that this private integration exists.

GRAFITE, FLUX, NEO SOFT and their shared configuration belong to the private Release Center package. Do not install a separate panel or enable Trial from this staging directory.

Validation:

```sh
python3 -B -m unittest discover -s tests/public-client -p 'test_lighting_*.py'
python3 -B staging/lighting/tests/test_native_ws.py
node tests/public-client/test_lighting_hacs_alpha55.cjs custom_components/cloudpelizzon
```
