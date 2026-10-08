---
'@credo-ts/core': minor
'@credo-ts/didcomm': minor
---

Remove the deprecated `SignatureSuiteToken` and `SignatureSuiteRegistry.registerSuite` / `registerSuites` / `getByVerificationMethodType` APIs. Configure linked-data proof signature suites with `new W3cCredentialsModule({ signatureSuites: [suiteInfo] })` when composing an agent. Built-in Ed25519 suites remain available unless a custom suite is configured with the same proof type, in which case the custom suite takes precedence. Callers constructing a `SignatureSuiteRegistry` directly must pass their suites to its constructor instead of adding them afterward. DIDComm now selects a signature suite using the issuer verification method's public key and type.
