---
'@credo-ts/core': patch
---

Update `@owf/mdoc`, `@owf/cose` and `@owf/token-status-list`, which add ISO/IEC 18013-5 conformance checks to mdoc verification:

- Device signed elements must be authorized by the `keyAuthorizations` in the MSO (9.1.3.4). Creating a device response with `deviceNameSpaces` the mdoc does not authorize now throws. `Mdoc.sign` accepts a new `keyAuthorizations` option to authorize namespaces or individual data elements.
- A CWT status list referenced by an mdoc must have an expiration time (12.3.6.3), and its `sub` must equal the URI it is referenced by. Pass `expiresAt` when creating a CWT token status list for mdocs.
- A device response with a status other than `0` must not contain documents, and a document must not contain the same element identifier twice in a namespace.
