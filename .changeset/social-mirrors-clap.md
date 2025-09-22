---
"@credo-ts/openid4vc": minor
---

Uses the correct credential structure in (Deferred) Credential Responses when using Draft 15+ of the OpenID for Verifiable Credential Issuance specification.

This means that Draft 15 is fully incompatible with previous drafts. As a consequence, the `version` option when creating a new offer credential has been changed to reflect that.
