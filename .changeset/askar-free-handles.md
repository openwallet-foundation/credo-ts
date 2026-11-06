---
'@credo-ts/askar': patch
---

Fixed native memory leaks in the Askar module. `getPublicKey` now frees the key it loads, which also stops it leaking a private key handle on every call. `transformPrivateKeyToPrivateJwk` and `transformSeedToPrivateJwk` now free the key they create. The key entry list is now also freed when reading a key fails.

Concurrent operations on a store that isn't open yet now share one open, instead of each opening the store and leaving all but the last one open. If a store gets opened while `openStore` or `provisionStore` is still running, the call closes its own store and throws an `AskarStoreAlreadyRegisteredError`. Operations that open the store on first use switch to the store that was opened instead of failing.
