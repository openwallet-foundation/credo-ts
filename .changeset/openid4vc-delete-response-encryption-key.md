---
'@credo-ts/openid4vc': patch
---

`deleteVerificationSessionById` now also deletes the key Credo created to decrypt the authorization response (`direct_post.jwt` and `dc_api.jwt`), from the backend stored in `responseEncryptionKey`. Before, a new key was created for every encrypted request and never deleted. For sessions from before `responseEncryptionKey`, the key is found through the `kid` of the encryption key in the stored request, or through its legacy key id when the `kid` is the key's fingerprint (sessions from before Credo 0.6). Pass `deleteAssociatedKey: false` to keep it. The key is also deleted when `createAuthorizationRequest` fails after creating it.

```ts
await agent.openid4vc.verifier.deleteVerificationSessionById(verificationSessionId)

// Keep the key
await agent.openid4vc.verifier.deleteVerificationSessionById(verificationSessionId, { deleteAssociatedKey: false })
```
