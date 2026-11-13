---
'@credo-ts/openid4vc': patch
---

The issuer now rejects a credential request with `invalid_proof` when the proof's key uses a binding method that the credential configuration doesn't list in `cryptographic_binding_methods_supported`. A `jwk` key matches `jwk` or `cose_key`. A DID matches `did:<method>`, or `did` for any method. Configurations without `cryptographic_binding_methods_supported` accept any key, as before.
