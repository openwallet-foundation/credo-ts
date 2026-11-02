---
'@credo-ts/anoncreds': patch
'@credo-ts/indy-vdr': patch
'@credo-ts/didcomm': patch
---

did:indy schema, credential definition and revocation registry ids with a percent-encoded schema name or tag, as the did:indy spec requires, now resolve. Credo treats the encoded and the unencoded form of an id as the same object everywhere it looks up or compares ids: records, credential queries, proof request restrictions, proof verification, auto accept and revocation notifications.

AnonCreds registries tell Credo which forms of an id are the same with the new optional `getIdentifierVariants` method. The indy-vdr registry implements it for did:indy ids.

New ids stay unencoded by default, so agents that don't support encoded ids can still resolve them. Set `encodeAnonCredsIdentifiers` to create encoded ids.

```ts
new IndyVdrModule({
  indyVdr,
  networks,
  encodeAnonCredsIdentifiers: true,
})
```
