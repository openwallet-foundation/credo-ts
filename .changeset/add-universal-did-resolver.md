---
'@credo-ts/core': minor
---

Add `UniversalDidResolver`, a `DidResolver` that resolves any configured list of DID methods through a [Universal Resolver](https://github.com/decentralized-identity/universal-resolver) instance (defaulting to the public `dev.uniresolver.io`, overridable for production use). Only a document that actually matches the DID asked about is accepted. Methods Credo already resolves itself (`key`, `jwk`, `peer`, `web`, `cheqd`) should not be listed here.
