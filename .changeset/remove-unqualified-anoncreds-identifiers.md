---
'@credo-ts/anoncreds': minor
'@credo-ts/indy-vdr': minor
'@credo-ts/didcomm': minor
'@credo-ts/drizzle-storage': minor
---

Remove support for unqualified (legacy) AnonCreds identifiers. All AnonCreds identifiers must be fully qualified. Use `did:indy` identifiers for objects on an indy ledger.

`@credo-ts/anoncreds`:

- The `LegacyIndyDidCommCredentialFormatService` and `LegacyIndyDidCommProofFormatService` classes are removed, together with the `LegacyIndyCredentialFormat` and `LegacyIndyDidCommProofFormat` types. The `hlindy/*` DIDComm formats only work with unqualified identifiers. Use the `AnonCredsDidCommCredentialFormatService` and `AnonCredsDidCommProofFormatService` classes instead.
- The `useLegacyProverDid` option of `createCredentialRequest` is removed from the holder service. A credential request always contains an `entropy` value.
- The `useUnqualifiedIdentifiers` option of `createProof` and the `useUnqualifiedIdentifiersIfPresent` option of `getCredential` are removed from the holder service.
- The unqualified identifier helpers are removed: `unqualifiedSchemaIdRegex`, `unqualifiedSchemaVersionRegex`, `unqualifiedIndyDidRegex`, `unqualifiedCredentialDefinitionIdRegex`, `unqualifiedRevocationRegistryIdRegex`, `getUnqualifiedSchemaId`, `getUnqualifiedCredentialDefinitionId`, `getUnqualifiedRevocationRegistryDefinitionId`, `isUnqualifiedIndyDid`, `isUnqualifiedSchemaId`, `isUnqualifiedCredentialDefinitionId`, `isUnqualifiedRevocationRegistryId`, `getQualifiedDidIndyDid`, `getUnQualifiedDidIndyDid`, the `(get|is)(Qualified|Unqualified)DidIndy(Schema|CredentialDefinition|RevocationRegistryDefinition)` helpers and `generateLegacyProverDidLikeString`.
- The `parseIndySchemaId`, `parseIndyCredentialDefinitionId` and `parseIndyRevocationRegistryId` functions only accept `did:indy` identifiers. The `namespace` property of the parsed result is always present.
- The `AnonCredsSchemaRecord` and `AnonCredsCredentialDefinitionRecord` classes do not have the `unqualifiedSchemaId` and `unqualifiedCredentialDefinitionId` tags anymore. The repositories only query by the qualified identifier.
- The W3C credential records of AnonCreds credentials do not get the `anonCredsUnqualifiedIssuerId`, `anonCredsUnqualifiedSchemaId`, `anonCredsUnqualifiedSchemaIssuerId`, `anonCredsUnqualifiedCredentialDefinitionId` and `anonCredsUnqualifiedRevocationRegistryId` tags anymore. Proof request restrictions only match the qualified identifiers.
- The storage migration from version 0.4 to 0.5 still migrates credentials that use unqualified identifiers. When the indy namespace of the issuer is not in the cache, the migration resolves the `did:sov` DID of the issuer to find the namespace. This requires the `IndyVdrSovDidResolver` and an `IndyVdrModule` that is configured with the ledger of the issuer.

`@credo-ts/indy-vdr`:

- The `IndyVdrAnonCredsRegistry` only resolves `did:indy` schema, credential definition and revocation registry identifiers. Unqualified identifiers are not supported anymore.

`@credo-ts/didcomm`:

- The revocation notification service only finds credential exchange records by the qualified revocation registry id. A revocation notification that contains an unqualified revocation registry id does not match a record anymore.

`@credo-ts/drizzle-storage`:

- The `unqualified_schema_id` column of the `AnonCredsSchema` table and the `unqualified_credential_definition_id` column of the `AnonCredsCredentialDefinition` table are removed. Run the database migrations to apply this change.
