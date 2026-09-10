---
"@credo-ts/webvh": patch
---

Sign did:webvh attested resources with a verification method authorized for the proof purpose

Attested resource proofs use the `assertionMethod` proof purpose, but the signing key was selected as
`verificationMethod[0]` without checking that it is referenced from `assertionMethod`. Resources were
written successfully and then failed to resolve with `Resolved resource proof is invalid.`

- Resource registration now selects a verification method authorized for `assertionMethod`, and
  validates an explicitly passed `options.verificationMethod` against that purpose.
- Newly created did:webvh dids reference their verification method from `assertionMethod`, and updating
  a did no longer drops it.
- `verifyProof` asserts the expected proof purpose and logs the issues returned by the verifier.

Existing dids need an `agent.dids.update` adding that reference, and the updated log republished, before
resources they sign will verify.
