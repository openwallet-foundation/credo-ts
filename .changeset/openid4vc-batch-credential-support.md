---
"@credo-ts/openid4vc": patch
---

The OpenID4VCI holder service now returns a single credential record per credential request containing all the instances:
- Credential records are pre-populated with KMS key IDs used during issuance
- The holder can store received batch credentials using the `store()` method on the appropriate credential record API (`sdJwtVc`, `mdoc`, `w3cCredentials`, `w3cV2Credentials`)

```typescript
const credentialResponse = await agent.openid4vc.holder.requestCredentials({
  // ...
})

// Store all received credentials
for (const credential of credentialResponse.credentials) {
  if (credential.record instanceof W3cCredentialRecord) {
    await agent.w3cCredentials.store({ record: credential.record })
  }
  // Handle other credential types...
}
```