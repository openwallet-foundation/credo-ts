---
"@credo-ts/anoncreds": minor
"@credo-ts/didcomm": minor
---

Make DIDComm an optional peer of AnonCreds. Supply the Data Integrity link-secret binding provider explicitly through the format service's linkSecretBinding option instead of the removed DI token. Move auto-accept helpers to the DIDComm subpath. Legacy storage migrations preserve the existing upgrade sequence without statically or dynamically importing DIDComm from the AnonCreds root. To preserve historical exchange records, explicitly configure `migrationProvider: new AnonCredsDidCommMigrationProvider()` from `@credo-ts/anoncreds/didcomm` and register the DIDComm credentials module. Without this integration, the AnonCreds 0.3.1→0.4 migration skips exchange-record updates with a warning. The 0.4→0.5 migration continues converting credentials without relinking exchange records, with warnings; the credentials remain usable independently. Skipped exchange updates are not retried automatically if DIDComm is enabled later. Unexpected migration failures stop the storage update.
