# CloudPelizzon Fleet — enrollment required (pilot)

This branch is **not** a production release. Before publishing:
1. Deploy, protect and test the Fleet /api/v1/activate endpoint exposed via HTTPS.
2. Issue pairing codes only through authenticated Customer Portal downloads, after explicit informed consent. Codes must be single-use, unpredictable, time-limited and bound to a delivered download and customer.
3. Verify matching Installation ID in Fleet; guarantee failure does not activate an installation.
4. Test fresh HA installation and replacement/migration, network outage, expired code, reuse and copy to a second HA.
5. Verify privacy notice and continued reporting policy, including data retention and customer access.
6. Publish a tagged GitHub release after passing HACS/hassfest CI and pilot.

Public GitHub/HACS downloads **cannot** be gated by the Portal. This implementation prevents new configurations from activating without a Fleet response; it does not prevent copying or patching public source code.

This pilot changes only the flow for new configuration entries. Previously configured installations require a separate, safe migration and registration path. Do not market fleet inventory as a complete census until legacy registration is completed.

This pilot does not enable payment entitlements or bypass existing commercial licensing.
