---
"@credo-ts/anoncreds": minor
"@credo-ts/didcomm": minor
---

Make DIDComm an optional peer of AnonCreds. Supply the Data Integrity link-secret binding provider explicitly through the format service's linkSecretBinding option instead of the removed DI token. Move auto-accept helpers to the DIDComm subpath and load DIDComm lazily for legacy storage migrations, preserving the existing upgrade sequence.
