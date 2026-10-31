---
'@credo-ts/core': minor
---

The `getTrustedIssuersForVerification` callback is now called with the `mdocDcApiCredential` verification type when an mdoc in a DC API response is verified, instead of the `credential` type. It carries the `mdocVerificationSessionRecord`, so trust can depend on the verification session, like `openId4VpCredential` does for OpenID4VP.
