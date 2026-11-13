---
"@credo-ts/core": patch
---

Fixed parsing a W3C JWT VC that keeps `issuanceDate`/`expirationDate` in the `vc` body with sub-second precision. The consistency check now compares `nbf`/`exp` with the `vc` dates at whole-second precision on both sides, so millisecond dates (as produced by `Date#toISOString()`) and fractional `nbf`/`exp` (allowed by RFC 7519) are both accepted.
