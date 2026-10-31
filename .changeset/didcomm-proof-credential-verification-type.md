---
'@credo-ts/didcomm': minor
---

The `getTrustedIssuersForVerification` callback is now called with the `didCommProofCredential` verification type for W3C credentials in a presentation received with the DIF Presentation Exchange proof format. It carries the `didCommProofExchangeRecord`, so trust can depend on the proof exchange, like `openId4VpCredential` does for OpenID4VP. When the callback returns `undefined`, it is called again with the core `credential` verification type. Pass `DidCommVerificationTypes` as the additional verification types to get full type coverage.
