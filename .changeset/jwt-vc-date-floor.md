---
"@credo-ts/core": patch
---

Fixed parsing a W3C JWT VC that keeps `issuanceDate`/`expirationDate` in the `vc` body with sub-second precision. The consistency check compared the JWT `nbf`/`exp` (integer seconds) against `Date.parse(...) / 1000` without flooring, so a millisecond-precision date (as produced by `Date#toISOString()`) never matched and the credential was wrongly rejected. The dates are now floored to match the encoder.
