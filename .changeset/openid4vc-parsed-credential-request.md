---
'@credo-ts/openid4vc': minor
---

Breaking: `createCredentialResponse` on the issuer takes the `parsedCredentialRequest` returned by the issuer's `parseCredentialRequest` instead of a raw `credentialRequest`, so the request is not parsed a second time without knowing whether it arrived encrypted.
