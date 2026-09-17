---
"@credo-ts/core": patch
"@credo-ts/openid4vc": patch
---

Fix selective disclosure of SD-JWT array elements when presenting with DCQL. Array elements that are selectively disclosable on their own were not disclosed, even when requested. They are now disclosed by their position in the array.

DCQL claim sets of SD-JWT VC and W3C V2 SD-JWT VC credentials now include `disclosed_paths`: the paths to the claims the presentation discloses, including the claims that are not selectively disclosable. An array element has the position it has in the claims of the credential, where decoy digests don't count. A path stands for the claim and everything below it, so a claim that is disclosed as a whole has a single path. Pass them as the new `disclosedPaths` in `DcqlCredentialsForRequest` (done automatically by `selectCredentialsForRequest`).

Disclosing an SD-JWT VC or W3C V2 SD-JWT VC based on `disclosedPayload` is deprecated, as it selects arrays as a whole. `disclosedPaths` will be required for these formats in the next breaking version.

For the same reason, `applyDisclosuresForPayload` on `SdJwtVcService` and `W3cV2SdJwtCredentialService` is deprecated in favor of the new `applyDisclosuresForPaths`.

`IDisclosureFrame` now also allows array positions in `_sd`, and the `ClaimPath` type is exported.
