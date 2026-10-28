---
'@credo-ts/anoncreds': patch
---

An AnonCreds presentation for a DIF Presentation Exchange definition now finds the attribute of a field path in any supported notation, such as `$['credentialSubject']['age']`. Before, a field in another notation than `$.credentialSubject.age` was left out of the proof request. A field that addresses a nested claim of `credentialSubject` is now rejected.
