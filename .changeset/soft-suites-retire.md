---
'@credo-ts/core': minor
'@credo-ts/didcomm': minor
---

Remove the deprecated `SignatureSuiteToken` and `SignatureSuiteRegistry.registerSuite` / `registerSuites` / `getByVerificationMethodType` APIs. The `W3cCredentialsModule` continues to register the built-in Ed25519 suites, but no longer collects custom suites previously registered through `SignatureSuiteToken`. Callers constructing a `SignatureSuiteRegistry` directly must pass their suites to its constructor instead of adding them afterward. DIDComm now selects a signature suite using the issuer verification method's public key and type.
