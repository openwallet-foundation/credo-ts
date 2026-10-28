---
'@credo-ts/webvh': patch
---

Only use Ed25519 keys to sign did:webvh attested resources, as the attested resources specification requires `eddsa-jcs-2022`. A non-Ed25519 `Multikey` or `JsonWebKey2020` key in `assertionMethod`, such as a P-256 key, is no longer selected automatically, and an explicit `verificationMethod` that is not an Ed25519 key is rejected. Resolving an attested resource now also fails when its proof uses a cryptosuite other than `eddsa-jcs-2022`.
