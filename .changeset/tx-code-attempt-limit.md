---
'@credo-ts/openid4vc': patch
---

The issuer now limits the number of invalid `tx_code` values a wallet can send for an issuance session. After 5 invalid attempts the issuance session moves to the `Error` state and the credential offer can no longer be used. Configure the limit with the `txCodeMaxAttempts` issuer option. The attempts are stored in the new `failedTxCodeAttempts` property of the `OpenId4VcIssuanceSessionRecord`. The limit holds across concurrent requests only when the storage supports record locking, such as Postgres.
