---
'@credo-ts/drizzle-storage': patch
---

The `batchCredentialIssuance` of an OpenID4VC issuer is now stored as JSON. Saving an issuer with `batchCredentialIssuance` failed on SQLite, and on PostgreSQL it was loaded as a string. The new `0010_batch_credential_issuance_json` migration of the `openid4vc` bundle converts the PostgreSQL column to `jsonb`. Run the migrations after upgrading.
