---
"@credo-ts/openid4vc": patch
---

For new credential deferrals, Credo keeps track of until when the transaction is deferred.
If the wallet calls the endpoint before the interval has passed by, we automatically
return a new deferral response with the remaining interval.
