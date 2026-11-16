---
'@credo-ts/didcomm': minor
---

The `didcomm_signed_attachment` binding method types now have neutral names, such as `DidCommSignedAttachmentBindingMethods` and `DidCommSignedAttachmentOfferBindingMethod`, shared by the W3C VC SD-JWT and `dc+sd-jwt` credential formats. This is a breaking change, the old `W3cV2SdJwt` names (such as `W3cV2SdJwtBindingMethods` and `W3cV2SdJwtDidCommSignedAttachmentBindingProof`) are removed.
