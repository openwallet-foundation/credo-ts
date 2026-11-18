---
'@credo-ts/core': minor
---

Add the `JsonWebSignature2020` linked data proof signature suite, alongside the existing `Ed25519Signature2018`/`Ed25519Signature2020` suites. It signs and verifies a JSON-LD credential or presentation using a JWS over the JCS-canonicalised document, with a `did:...#...` verification method as `kid`, matching the construction other VC tooling (including Veramo) already produces.

Adds a `VeramoInterop` test suite with fixtures generated against Veramo's own `JsonWebSignature2020` implementation, so this suite's output and acceptance is checked against a real external implementation rather than only round-tripped against itself.
