---
"@credo-ts/didcomm": patch
"@credo-ts/core": patch
---

Added Aries RFC 881 (vc+sd-jwt) format handler

`@credo-ts/core` now exports `validateW3cV2SdJwtDisclosureFrame` and `NON_DISCLOSEABLE_FIELDS`, so that
a disclosure frame can be validated before it is used to sign a credential.
