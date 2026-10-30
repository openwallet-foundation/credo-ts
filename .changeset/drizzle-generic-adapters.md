---
'@credo-ts/drizzle-storage': patch
'@credo-ts/core': patch
'@credo-ts/anoncreds': patch
'@credo-ts/drpc': patch
'@credo-ts/openid4vc': patch
---

The drizzle record adapters now map records to columns using the record's `encodingSchema`, instead of a hand-written mapping per record. A column with the name of a record property stores the encoded property, other columns store the tag with that name, and the remaining tags are stored in `customTags`. `getValues` and `toRecord` are no longer abstract in `BaseDrizzleRecordAdapter`, so custom adapters that implement them keep working. Records without an `encodingSchema` still need to implement them. Adapters that use the default mapping are validated when the `DrizzleStorageModule` is created: the record must define an `encodingSchema`, every record property must have a column, and the sqlite and postgres tables must have the same columns. Adapters that implement `getValues` and `toRecord` themselves are not validated. See the README for how to write adapters.

This fixes several issues with records stored using drizzle:

- OpenID4VC issuance sessions with holder binding keys in `transactions` could not be loaded, as the keys were not stored as JWKs. Sessions that were stored this way can be loaded again.
- The `openId4VciVersion` of issuance sessions and the `openId4VpVersion` of verification sessions were not stored. The new `0007_add_openid4vc_versions` migration of the `openid4vc` bundle adds the columns, and restores the `openId4VpVersion` of existing verification sessions from their tags. Run the migrations after upgrading.
- AnonCreds credential definition private, key correctness proof and revocation registry definition records lost their `credentialDefinitionId` when loaded.
- Custom tags of SD-JWT VC records were not restored when loaded.
- Clearing an optional property (for example `errorMessage`) was not persisted on update.

`DrpcRecord`, `AnonCredsLinkSecretRecord` and `AnonCredsRevocationRegistryDefinitionPrivateRecord` now set `createdAt` when they are created.

`getRecordPropertyNames` is added to `@credo-ts/core`, to get the property names of a record that defines its `encodingSchema` with `createRecordEncodingSchema`.
