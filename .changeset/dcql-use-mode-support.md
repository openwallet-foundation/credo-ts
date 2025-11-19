---
"@credo-ts/core": minor
---

Add `useMode` parameter to DCQL credential selection and presentation creation

The DCQL service now supports controlling which credential instance to use when creating presentations from multi-instance credential records. This is particularly useful for batch credentials or when you need to ensure fresh credential instances are used.

### Automatic credential selection with `useMode`

The `selectCredentialsForRequest()` method now accepts a `useMode` parameter to control which credential instances are selected:

```typescript
// or agent.openid4vc.holder.selectCredentialsForDcqlRequest
const selectedCredentials = dcqlService.selectCredentialsForRequest(queryResult, {
  useMode: CredentialMultiInstanceUseMode.New // Only use fresh, unused credential instances
})

// Or use first available (default behavior)
const selectedCredentials = dcqlService.selectCredentialsForRequest(queryResult, {
  useMode: CredentialMultiInstanceUseMode.NewOrFirst // Use new instances if available, otherwise use first
})
```

### Manual credential selection with `useMode`

When manually constructing the credentials for `createPresentation()`, you can now specify the `useMode` for each individual credential in the request:

```typescript
// or dcqlService.createPresentation
const dcqlPresentation = await agent.openid4vc.holder.acceptOpenId4VpAuthorizationRequest({
  dcql: {
  credentials: {
    'credential_query_1': [{
      claimFormat: ClaimFormat.SdJwtDc,
      credentialRecord: sdJwtVcRecord,
      disclosedPayload: { name: 'Alice' },
      useMode: CredentialMultiInstanceUseMode.New // Use a fresh instance for this credential
    }],
    'credential_query_2': [{
      claimFormat: ClaimFormat.MsoMdoc,
      credentialRecord: mdocRecord,
      disclosedPayload: { 'org.iso.18013.5.1': { given_name: true } },
      useMode: CredentialMultiInstanceUseMode.First // Always use the first instance
    }]
  },
  }
  // ... other options
})
```

### Available modes

- `CredentialMultiInstanceUseMode.New` - Only use credential instances that haven't been used yet. Throws an error if no new instances are available.
- `CredentialMultiInstanceUseMode.NewOrFirst` (default) - Prefer new instances, but fall back to the first instance if no new ones are available.
- `CredentialMultiInstanceUseMode.First` - Always use the first credential instance regardless of usage status.
- - `CredentialMultiInstanceUseMode.NewIfReceivedInBatch` -  Use a new unused instance if the credential was received as a batch (mimicking behavior of the `CredentialMultiInstanceUseMode.New` mode). If only a single instance was received it will use the first instance (mimicking behavior of the `CredentialMultiInstanceUseMode.First` mode).

This enables use cases like:
- Unlinkable presentations where each presentation uses a different credential instance from a batch
- Ensuring credential freshness by only using credentials that haven't been presented before
- Key rotation scenarios where new instances use different signing keys
- Fine-grained control over which credential instances are used in multi-credential presentations