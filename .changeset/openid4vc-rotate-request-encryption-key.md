---
'@credo-ts/openid4vc': patch
---

Add `rotateCredentialRequestEncryptionKey` and `deletePreviousCredentialRequestEncryptionKeys` to the issuer API, like the access token signing key. Rotating advertises a new credential request encryption key and moves the current keys to `previousKeys`, so requests encrypted to them still decrypt. Without `key`, a P-256 key is created in the backend of the current key. Deleting removes the previous keys, or only those in `keyIds`, and deletes them from the KMS. Pass `deleteFromKms: false` to only remove them from the issuer, for example when their KMS backend no longer exists. `deletePreviousAccessTokenSigningKeys` takes the same option.

When storing a rotation fails, the key Credo created for it is deleted again. This also applies to `rotateAccessTokenSigningKey`.

```ts
await agent.openid4vc.issuer.rotateCredentialRequestEncryptionKey(issuerId)

// Once wallets no longer use the previous keys
await agent.openid4vc.issuer.deletePreviousCredentialRequestEncryptionKeys(issuerId)
```
