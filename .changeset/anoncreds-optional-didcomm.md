---
"@credo-ts/anoncreds": minor
"@credo-ts/didcomm": minor
---

Make DIDComm an optional peer of AnonCreds. Supply the Data Integrity link-secret binding provider explicitly through the format service's linkSecretBinding option instead of the removed DI token. Move auto-accept helpers to the DIDComm subpath and load DIDComm lazily for legacy storage migrations, preserving the existing upgrade sequence. The AnonCreds 0.3.1→0.4 migration skips DIDComm exchange-record updates when the DIDComm credentials module is unavailable. The 0.4→0.5 migration still converts legacy AnonCreds credentials without DIDComm, but cannot relink DIDComm exchange records; unexpected migration failures stop the storage update.
