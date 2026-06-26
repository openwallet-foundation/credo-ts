---
"@credo-ts/core": patch
"@credo-ts/openid4vc": patch
---

Add a global `getTrustedIssuersForVerification` agent callback for resolving trusted issuers during verification. Unlike the now-deprecated X.509-module `getTrustedCertificatesForVerification` callback (which it takes precedence over), it supports both X.509 certificate chains and DIDs and is extensible to other trust mechanisms. It is wired into SD-JWT VC, mdoc, W3C V1 JWT and LD-JSON, W3C V2 JWT and SD-JWT, and OpenID4VP verification.
