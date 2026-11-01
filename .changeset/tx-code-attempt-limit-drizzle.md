---
'@credo-ts/drizzle-storage': patch
---

Add a `failed_tx_code_attempts` column to the `OpenId4VcIssuanceSession` table for the new `tx_code` attempt limit. Make sure to run the migrations for the `openid4vc` bundle.
