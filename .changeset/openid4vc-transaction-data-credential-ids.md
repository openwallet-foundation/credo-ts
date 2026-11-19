---
'@credo-ts/openid4vc': patch
---

The OpenID4VP verifier now rejects creating an authorization request whose `transactionData` references credential ids that are not in the DCQL query or presentation definition, as each id has to match a credential query or input descriptor id.
