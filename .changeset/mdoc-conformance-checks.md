---
'@credo-ts/core': patch
---

Update `@owf/mdoc`, `@owf/cose` and `@owf/token-status-list`, which add ISO/IEC 18013-5 conformance checks to mdoc verification:

- Device signed elements must be authorized by the `keyAuthorizations` in the MSO (9.1.3.4). When creating a device response, `deviceNameSpaces` values are only disclosed when they are requested and the mdoc authorizes them; other values are left out. `Mdoc.sign` accepts a new `keyAuthorizations` option to authorize namespaces or individual data elements.
- A CWT status list referenced by an mdoc must have an expiration time (12.3.6.3), and its `sub` must equal the URI it is referenced by. Pass `expiresAt` when creating a CWT token status list for mdocs.
- A device response with a status other than `0` must not contain documents, and a document must not contain the same element identifier twice in a namespace.
- The docType in the MSO must match the docType of the document, for every document in a device response (9.3.1).
- `issuing_country` and `issuing_jurisdiction` are checked against the `countryName` and `stateOrProvinceName` in the subject of the document signer certificate, instead of in its issuer (9.3.1). `issuing_jurisdiction` is only checked when the certificate has a `stateOrProvinceName`.
- `Mdoc.sign` throws when `validityInfo.validFrom` is before `signed`, which defaults to now, or when `validUntil` is not later than `validFrom` (9.1.2.4).
