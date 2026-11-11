---
'@credo-ts/core': minor
'@credo-ts/react-native': minor
---

JSON-LD credentials now use the upstream `jsonld`, `jsonld-signatures` and `@digitalbazaar/vc` libraries instead of the `@digitalcredentials` forks. React Native no longer needs `expo-crypto`. `@credo-ts/react-native` adds `crypto.subtle.digest` when it is missing, and the runtime must provide `TextEncoder`. Hermes provides it from React Native 0.74, which is now the minimum supported version.

Some things behave differently:

- Expiration and issuance dates of JSON-LD credentials are now checked with the `validitySkewSeconds` agent config (30 seconds by default). Before, no clock skew was allowed.
- The `vcJs` validation result no longer contains a `log` property, and its `credentialResults` no longer contain the `credential`.
