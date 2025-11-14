---
"@credo-ts/core": minor
"@credo-ts/anoncreds": minor
"@credo-ts/openid4vc": minor
"@credo-ts/drizzle-storage": minor
---

**BREAKING**: Refactored credential storage to support batch credentials with KMS key tracking

This is a significant change to how credentials are stored and accessed in Credo. The main user-facing changes are:

### Credential Records now support multiple credential instances

All credential record types (`W3cCredentialRecord`, `W3cV2CredentialRecord`, `SdJwtVcRecord`, `MdocRecord`) now support storing multiple credential instances in a single record. This enables:
- Batch issuance workflows where multiple credentials are issued together
- Tracking which KMS key was used to sign each credential instance
- Better support for credential refresh and reissuance scenarios

### API Changes

**Storing Credentials:**
- The `storeCredential()` method now expects a `record` parameter instead of a `credential` parameter
- You must create the record first using `W3cCredentialRecord.fromCredential()` or similar constructors. Store credential expecting a record allows the OpenID4VC module to already return the credential record with the linked kms keys. In the future the OpenID4VC display metadata will also be added to the record automatically.

```typescript
// Before
await agent.w3cCredentials.storeCredential({ credential })

// After
const record = W3cCredentialRecord.fromCredential(credential)
await agent.w3cCredentials.store({ record })
```

**Accessing Credentials:**
- Records now use `firstCredential` property to access the primary credential instead of `credential`
- Use `credentialInstances` array to access all instances in a batch record
- The `multiInstanceState` property tracks the state of credential instances:
  - `SingleInstanceUnused`: Single instance that has never been used
  - `SingleInstanceUsed`: Single instance that has been used at least once
  - `MultiInstanceFirstUnused`: Credential was originally a multi instance credential, where the first instance is unused.
  - `MultiInstanceFirstUsed`:  Credential was originally a multi instance credential, where the first instance is used.  It may still have other instances that are unused (which can be detected if the length of credentialInstances > 1)

```typescript
// Before
const credential = record.credential

// After
const credential = record.firstCredential

// Check credential state
if (record.multiInstanceState === CredentialMultiInstanceState.MultiInstanceLastUnused) {
  // Has unused instances available
}
```

### KMS Key Tracking

Credential instances now track which KMS key was used to sign them:
- Each credential instance can have an associated `kmsKeyId`
- This enables key rotation and multi-tenant scenarios where different keys are used
- The KMS key ID is stored in the credential record and synced with credential metadata

### Storage Service Updates

- Added `lockedUpdate()` method to storage services for atomic updates with record locking
- Prevents race conditions when updating records concurrently
- Throws error if trying to update a record that has been modified since it was loaded

### Migration Notes

If you have custom code that:
- Stores credentials using `storeCredential()` - update to use the new `store()` API
- Accesses `record.credential` - update to use `record.firstCredential`
- Directly constructs credential records - ensure you use the proper constructors with `credentialInstances` array