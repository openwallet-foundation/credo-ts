---
"@credo-ts/core": patch
---

Support treating the doc requests of an mdoc device request as alternatives, of which only one has to be satisfied. A device request with more than one doc request does not say whether it asks for all of them or for any one of them, so both sides opt in with `treatAmbiguousMultipleDocRequestsAsAlternatives`: on `createDcApiVerificationSession` for the verifier, which stores it on the session and applies it when the response is verified, and on `resolveDcApiRequest` for the wallet. The resolved request and the device request match now carry `docRequestsAsAlternatives`, which is only `true` when the option is set and the request has more than one doc request. A resolved request that succeeds this way keeps the doc requests that could not be answered, so only create a response for the ones that succeeded.
