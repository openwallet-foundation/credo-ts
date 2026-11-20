---
'@credo-ts/drizzle-storage': patch
---

Adds the `session_key` column to `MdocVerificationSession`. The `session_key_id` column is no longer written and becomes nullable, and rows that only have it still load. Adds the `access_token_key` and `previous_access_token_keys` columns to `Openid4vcIssuer` and the `response_encryption_key` column to `OpenId4VcVerificationSession`.
