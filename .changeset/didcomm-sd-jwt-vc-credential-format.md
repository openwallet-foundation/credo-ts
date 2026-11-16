---
'@credo-ts/didcomm': patch
'@credo-ts/core': patch
---

Add the experimental `dc+sd-jwt` credential format for issue-credential v2 (Aries RFC 0884). `DidCommSdJwtVcCredentialFormatService` offers and issues IETF SD-JWT VCs, can bind them to the key that signed the holder's binding proof and stores them as an `SdJwtVcRecord`.

The signed attachment of the `didcomm_signed_attachment` binding method now writes `data.base64` as unpadded base64url, for every format that uses it (RFC 0809, RFC 0881 and RFC 0884). Credo reads both padded and unpadded data.

`SdJwtVcService` now resolves a holder `cnf.kid` in the `authentication` relationship too, when signing and verifying an SD-JWT VC. `SdJwtVcApi.fetchTypeMetadata` also takes a `vct` with an optional `vct#integrity`, to fetch Type Metadata without an SD-JWT VC.
