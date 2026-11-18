---
'@credo-ts/drizzle-storage': patch
---

Add the `notifications` and `notification_ids` columns to the `OpenId4VcIssuanceSession` table, for the OpenID4VCI notification endpoint. Make sure to run the migrations for the `openid4vc` bundle.
