---
"@credo-ts/core": patch
---

Verifying a JSON-LD (`ldp_vp`) presentation now only counts the presentation proofs that verify when it checks that the holder controls the `credentialSubject` of each credential. A proof set passes when one of its proofs verifies, so a second proof that didn't verify could authenticate a subject the presenter doesn't control.
