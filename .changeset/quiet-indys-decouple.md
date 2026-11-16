---
'@credo-ts/anoncreds': minor
'@credo-ts/indy-vdr': minor
---

Move did:indy identifier utilities into `@credo-ts/indy-vdr` and make its AnonCreds registry optional.

- Import `IndyVdrAnonCredsRegistry` from `@credo-ts/indy-vdr/anoncreds` instead of `@credo-ts/indy-vdr`.
- Import `IndyVdrRegisterSchema`, `IndyVdrRegisterSchemaInternalOptions`, `IndyVdrRegisterSchemaExternalCreateOptions`, `IndyVdrRegisterSchemaExternalSubmitOptions`, `IndyVdrRegisterSchemaReturnStateAction`, `IndyVdrRegisterSchemaReturn`, and `IndyVdrRegisterSchemaOptions` from `@credo-ts/indy-vdr/anoncreds` instead of `@credo-ts/indy-vdr`.
- Import `IndyVdrRegisterCredentialDefinition`, `IndyVdrRegisterCredentialDefinitionInternalOptions`, `IndyVdrRegisterCredentialDefinitionExternalCreateOptions`, `IndyVdrRegisterCredentialDefinitionExternalSubmitOptions`, `IndyVdrRegisterCredentialDefinitionReturnStateAction`, `IndyVdrRegisterCredentialDefinitionReturn`, and `IndyVdrRegisterCredentialDefinitionOptions` from `@credo-ts/indy-vdr/anoncreds` instead of `@credo-ts/indy-vdr`.
- Import `IndyVdrRegisterRevocationRegistryDefinition`, `IndyVdrRegisterRevocationRegistryDefinitionInternalOptions`, `IndyVdrRegisterRevocationRegistryDefinitionExternalCreateOptions`, `IndyVdrRegisterRevocationRegistryDefinitionExternalSubmitOptions`, `IndyVdrRegisterRevocationRegistryDefinitionReturnStateAction`, `IndyVdrRegisterRevocationRegistryDefinitionReturn`, and `IndyVdrRegisterRevocationRegistryDefinitionOptions` from `@credo-ts/indy-vdr/anoncreds` instead of `@credo-ts/indy-vdr`.
- Import `IndyVdrRegisterRevocationStatusList`, `IndyVdrRegisterRevocationStatusListInternalOptions`, `IndyVdrRegisterRevocationStatusListExternalCreateOptions`, `IndyVdrRegisterRevocationStatusListExternalSubmitOptions`, `IndyVdrRegisterRevocationStatusListReturnStateAction`, `IndyVdrRegisterRevocationStatusListReturn`, and `IndyVdrRegisterRevocationStatusListOptions` from `@credo-ts/indy-vdr/anoncreds` instead of `@credo-ts/indy-vdr`.
- Import `didIndyRegex`, `parseIndyDid`, `isIndyDid`, and `getIndyNamespaceFromIndyDid` from `@credo-ts/indy-vdr` instead of `@credo-ts/anoncreds`.
- `getIndyNamespaceFromIndyDid` now accepts only bare did:indy DIDs and throws for AnonCreds object IDs or other DID URLs. For AnonCreds object IDs, use the corresponding `parseIndySchemaId`, `parseIndyCredentialDefinitionId`, or `parseIndyRevocationRegistryId` from `@credo-ts/indy-vdr/anoncreds` and read its `namespace` property.
- Import `didIndySchemaIdRegex`, `didIndyCredentialDefinitionIdRegex`, `didIndyRevocationRegistryIdRegex`, `isDidIndySchemaId`, `isDidIndyCredentialDefinitionId`, `isDidIndyRevocationRegistryId`, `parseIndySchemaId`, `parseIndyCredentialDefinitionId`, `parseIndyRevocationRegistryId`, and the `ParsedIndySchemaId`, `ParsedIndyCredentialDefinitionId`, and `ParsedIndyRevocationRegistryId` types from `@credo-ts/indy-vdr/anoncreds` instead of `@credo-ts/anoncreds`.
- `@credo-ts/indy-vdr` no longer requires `@credo-ts/anoncreds` unless its `./anoncreds` subpath is used.
