---
"@credo-ts/openid4vc": patch
---

Add `ignoreWalletAttestationsWhenNotRequired` to the OpenID4VC issuer module config. By default, a wallet attestation provided by a client is always verified, even if the issuance session doesn't require it, and an invalid attestation fails the request. When enabled, a wallet attestation that is not required is ignored at the token, pushed authorization request and authorization challenge endpoints, so wallets that send an invalid attestation can still complete issuance sessions that don't require one.
