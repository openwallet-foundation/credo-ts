---
"@credo-ts/didcomm": patch
"@credo-ts/core": patch
---

Added Aries RFC 881 (vc+sd-jwt) format handler

`@credo-ts/core` now exports `validateW3cV2SdJwtDisclosureFrame` and `NON_DISCLOSEABLE_FIELDS`, so that
a disclosure frame can be validated before it is used to sign a credential.

The `didcomm_signed_attachment` binding method is now implemented by a helper shared with the data
integrity format. As a result the data integrity format also accepts a binding proof whose attachment
payload is base64url encoded, in addition to base64. Signed attachments are still produced as base64,
so this only widens what is accepted from other agents.
