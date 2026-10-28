---
'@credo-ts/core': patch
'@credo-ts/react-native': minor
---

`createKey` and `createKeyForSignatureAlgorithm` of the KMS accept `backendOptions` together with `backend`, which are passed to that backend.

The `secureEnvironment` backend now requires `@animo-id/expo-secure-environment` 0.3, and takes its `generateKeypair` options as `backendOptions`.

`SecureEnvironmentKeyManagementService.withUserAuthentication(agentContext, callback, options)`: signatures of that agent context in the callback ask the user to authenticate at most once, for the first key that requires it (iOS). `keyIds` limits it to the given keys, other keys ask for every signature as before.

```ts
const secureEnvironment = new SecureEnvironmentKeyManagementService({
  prompt: () => ({ title: t('Sign with your wallet') }),
})
// modules: { kms: new KeyManagementModule({ backends: [new AskarKeyManagementService(), secureEnvironment] }) }

await agent.kms.createKey({
  type: { kty: 'EC', crv: 'P-256' },
  backend: 'secureEnvironment',
  backendOptions: {
    userAuthentication: { methods: ['biometric', 'deviceCredential'] },
    minimumKeyStorage: 'trustedEnvironment',
  },
})

await secureEnvironment.withUserAuthentication(agent.context, () => presentCredentials(), {
  keyIds: credentialKeyIds,
  prompt: { title: t('Share 2 credentials') },
})
```
