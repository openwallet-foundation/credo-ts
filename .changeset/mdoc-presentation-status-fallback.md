---
"@credo-ts/core": patch
---

fix(mdoc): accept status lists signed by the credential's issuance chain during presentation (device response) verification

The mdoc presentation verification path (`MdocDeviceResponse.verify`, used by OpenID4VP) did not fall back to the issuance certificates when a trusted issuer was configured without dedicated `status` certificates (`status: undefined`). As a result, an mdoc carrying a token status list signed by the same certificate as the credential failed presentation verification, while the equivalent SD-JWT VC and standalone `Mdoc.verify` cases succeeded. The fallback (and the chain-equality safeguard that prevents it from widening the trust set) is now shared between `Mdoc.verify` and `MdocDeviceResponse.verify`.
