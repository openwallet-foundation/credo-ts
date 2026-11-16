---
"@credo-ts/openid4vc": patch
"@credo-ts/core": patch
---

fix(openid4vc): advertise legacy COSE algorithms for the `mso_mdoc` format in the verifier's `vp_formats_supported`. Alongside the RFC 9053 fully-specified algorithms (ESP256 -9, ESP384 -51, Ed25519 -19), the verifier now also advertises their deprecated/legacy polymorphic equivalents (ES256 -7, ES384 -35, EdDSA -8).