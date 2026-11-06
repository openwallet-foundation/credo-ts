---
'@credo-ts/didcomm': patch
---

Add the experimental `dc+sd-jwt` credential format for issue-credential v2 (Aries RFC 0884). `DidCommSdJwtVcCredentialFormatService` offers and issues IETF SD-JWT VCs, can bind them to the key that signed the holder's binding proof and stores them as an `SdJwtVcRecord`.
