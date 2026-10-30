---
'@credo-ts/drizzle-storage': patch
---

Add a `credential_request_encryption` column to the `OpenId4VcIssuer` table for the issuer's `credentialRequestEncryption` configuration. Make sure to run the migrations for the `openid4vc` bundle.
