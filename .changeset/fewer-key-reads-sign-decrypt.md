---
'@credo-ts/core': patch
'@credo-ts/openid4vc': patch
---

Signing a JWS and decrypting an OpenID4VP authorization response each read the key from the key management service one time less. `JwsService` passes the backend that holds the key to `sign`, so the key is not looked up a second time to find its backend, and the OpenID4VC JWE decrypt callback no longer reads the public key back after decrypting.

When a single key management backend supports an operation, `sign`, `verify`, `encrypt` and `decrypt` no longer read the public key first to find the backend of the key. The backend reports a missing key itself.

The operation passed to `isOperationSupported` for `sign`, `verify`, `encrypt` and `decrypt` now has the `keyId` of the key it runs with. A backend that knows the key is not its own can return `false`, which leaves a single backend and skips the lookup.
