---
'@credo-ts/openid4vc': patch
---

fix(openid4vc): when resolving an OpenID4VP authorization request with a DCQL query, the holder now rejects transaction data entries that reference credential ids not present in the DCQL query with an `invalid_transaction_data` error, instead of throwing a `TypeError`.
