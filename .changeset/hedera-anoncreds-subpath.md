---
'@credo-ts/hedera': minor
---

Separate Hedera DID operations from the AnonCreds registry implementation by moving registry operations and issuer-key signing from `HederaLedgerService` into a dedicated `HederaAnonCredsService`. The AnonCreds methods formerly on `HederaLedgerService` are removed. Expose `HederaAnonCredsRegistry` only through the `@credo-ts/hedera/anoncreds` subpath and make `@credo-ts/anoncreds` and `@hiero-did-sdk/anoncreds` optional peer dependencies. Consumers using the Hedera AnonCreds registry must install both packages explicitly and register `HederaModule`; DID-only consumers no longer need AnonCreds installed.
