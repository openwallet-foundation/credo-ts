---
"@credo-ts/openid4vc": patch
---

feat: interpret key attestation ISO 18045 levels hierarchically on the issuer, so a stronger attested level (e.g. `iso_18045_high`) satisfies a weaker required level (e.g. `iso_18045_moderate`). Also adds the `OpenId4VciKeyAttestationLevel` enum and `keyAttestationLevelSatisfies` helper.
