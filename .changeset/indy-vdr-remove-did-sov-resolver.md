---
'@credo-ts/indy-vdr': minor
---

Remove the `IndyVdrSovDidResolver`. Credo does not resolve `did:sov` DIDs anymore. Use `did:indy` DIDs with the `IndyVdrIndyDidResolver`.

- The `getPoolForDid` method of the `IndyVdrPoolService` only accepts `did:indy` DIDs and is synchronous. It does not look up unqualified DIDs on all configured ledgers anymore, and it does not return a `nymResponse`.
- The `IndyVdrPoolService` constructor does not take a logger anymore.
