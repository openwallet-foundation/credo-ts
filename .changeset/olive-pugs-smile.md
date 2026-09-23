---
'@credo-ts/core': patch
---

Fix `SdJwtVcSignOptions.hashingAlgorithm` being ignored when issuing an SD-JWT VC.

`sign()` rejected every value other than `sha-256` and then hardcoded `sha-256` as the hash algorithm of the `@sd-jwt` instance, so the option could only ever hold its documented default. The option is now passed through, meaning an issuer can produce a credential with e.g. `_sd_alg: "sha-512"` and SHA-512 disclosure digests, as allowed by SD-JWT VC. The option type now excludes `sha-1`, matching the W3C VC 2.0 SD-JWT sign options, since `_sd_alg` must name a hash algorithm that is considered secure.
