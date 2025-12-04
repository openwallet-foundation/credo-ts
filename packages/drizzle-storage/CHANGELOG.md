# @credo-ts/drizzle-storage

## 0.6.0

### Minor Changes

- cd6c836: Adds support for chained authorization code flows within the OpenID4VCI credential issuance. This means that external authorization servers can be leveraged to authenticate or identify the user. The access token from this external authorization server can be then used during the issuance process in order to, for example, fetch credential data from an external resource server.
- 6cb8d27: feat: add support for new SQLite and PostgreSQL storage based on Drizzle.

  The Drizzle Storage Module is an additional storage implementation for Credo which natively integrates with PostgreSQL and SQLite. It can be combined with Aries Askar as the KMS.

  The Drizzle Storage Module does not introduce any breaking chnages to how the storage APIs works in Credo, and for new projects you only have to configure the Drizzle module to connect to your database.

- 0500765: **BREAKING**: Refactored credential storage to support batch credentials with KMS key tracking

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
  await agent.w3cCredentials.storeCredential({ credential });

  // After
  const record = W3cCredentialRecord.fromCredential(credential);
  await agent.w3cCredentials.store({ record });
  ```

  **Accessing Credentials:**

  - Records now use `firstCredential` property to access the primary credential instead of `credential`
  - Use `credentialInstances` array to access all instances in a batch record
  - The `multiInstanceState` property tracks the state of credential instances:
    - `SingleInstanceUnused`: Single instance that has never been used
    - `SingleInstanceUsed`: Single instance that has been used at least once
    - `MultiInstanceFirstUnused`: Credential was originally a multi instance credential, where the first instance is unused.
    - `MultiInstanceFirstUsed`: Credential was originally a multi instance credential, where the first instance is used. It may still have other instances that are unused (which can be detected if the length of credentialInstances > 1)

  ```typescript
  // Before
  const credential = record.credential;

  // After
  const credential = record.firstCredential;

  // Check credential state
  if (
    record.multiInstanceState ===
    CredentialMultiInstanceState.MultiInstanceLastUnused
  ) {
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

- bc6f0c7: Add support for ESM module syntax.

  - Use `tsdown` to bundle for ESM -> tsdown is based on rust, so it should help with performance
  - Update to `vitest` since jest doesn't work well with ESM -> this should also help with performance
  - Simplify type checking -> just a single type check script instead of one for all packages. This should help with performance.

  NOTE: Since React Native bundles your code, the update to ESM should not cause issues. In addition all latest minor releases of Node 20 and 22 now support requiring ESM modules. This means that even if you project is still a CommonJS project, it can now depend on ESM modules. For this reason Credo is now fully an ESM module.

  Initially we added support for both CJS and ESM in parallel. However this caused issues with some libraries requiring the CJS output, and other the ESM output. Since Credo is only meant to be installed a single time for the dependency injection to work correctly, this resulted in unexpected behavior.

### Patch Changes

- 7fb0092: fix: throw RecordDuplicateError when record already exists in Drizzle storage
- 645363d: feat: add support for creating and hosting signed credential issuer metadata
- Updated dependencies [55318b2]
- Updated dependencies [e936068]
- Updated dependencies [43148b4]
- Updated dependencies [8dc1156]
- Updated dependencies [a888c97]
- Updated dependencies [2d10ec3]
- Updated dependencies [6d83136]
- Updated dependencies [cd6c836]
- Updated dependencies [312a7b2]
- Updated dependencies [1495177]
- Updated dependencies [1810764]
- Updated dependencies [2cace9c]
- Updated dependencies [66d3384]
- Updated dependencies [879ed2c]
- Updated dependencies [a64ada0]
- Updated dependencies [8a816d8]
- Updated dependencies [297d209]
- Updated dependencies [2312bb8]
- Updated dependencies [11827cc]
- Updated dependencies [81dbbec]
- Updated dependencies [9f78a6e]
- Updated dependencies [297d209]
- Updated dependencies [652ade8]
- Updated dependencies [0500765]
- Updated dependencies [568cc13]
- Updated dependencies [2cace9c]
- Updated dependencies [bea846b]
- Updated dependencies [13cd8cb]
- Updated dependencies [6f3f621]
- Updated dependencies [2cace9c]
- Updated dependencies [15acc49]
- Updated dependencies [df7580c]
- Updated dependencies [95e9f32]
- Updated dependencies [e936068]
- Updated dependencies [16f109f]
- Updated dependencies [7e6e8f0]
- Updated dependencies [e936068]
- Updated dependencies [617b523]
- Updated dependencies [90caf61]
- Updated dependencies [b5fc7a6]
- Updated dependencies [1f74337]
- Updated dependencies [589a16e]
- Updated dependencies [e936068]
- Updated dependencies [dca4fdf]
- Updated dependencies [17ec6b8]
- Updated dependencies [fccb5ab]
- Updated dependencies [9f78a6e]
- Updated dependencies [14673b1]
- Updated dependencies [0c274fe]
- Updated dependencies [2cace9c]
- Updated dependencies [607659a]
- Updated dependencies [9f78a6e]
- Updated dependencies [fee0260]
- Updated dependencies [44b1866]
- Updated dependencies [5f08bc6]
- Updated dependencies [27f971d]
- Updated dependencies [9f78a6e]
- Updated dependencies [cacd8ee]
- Updated dependencies [0d877f5]
- Updated dependencies [e936068]
- Updated dependencies [2d10ec3]
- Updated dependencies [09ea6e3]
- Updated dependencies [0500765]
- Updated dependencies [1a4182e]
- Updated dependencies [8be3d67]
- Updated dependencies [a4f443b]
- Updated dependencies [90caf61]
- Updated dependencies [9f78a6e]
- Updated dependencies [9f78a6e]
- Updated dependencies [e936068]
- Updated dependencies [290ff19]
- Updated dependencies [0500765]
- Updated dependencies [8baa7d7]
- Updated dependencies [17ec6b8]
- Updated dependencies [decbcac]
- Updated dependencies [c57cece]
- Updated dependencies [9df09fa]
- Updated dependencies [2cace9c]
- Updated dependencies [9f78a6e]
- Updated dependencies [70c849d]
- Updated dependencies [0c274fe]
- Updated dependencies [8baa7d7]
- Updated dependencies [897c834]
- Updated dependencies [468e9b4]
- Updated dependencies [cfc2ac4]
- Updated dependencies [5ff7bba]
- Updated dependencies [a53fc54]
- Updated dependencies [81e3571]
- Updated dependencies [9ef54ba]
- Updated dependencies [a4bdf6d]
- Updated dependencies [17ec6b8]
- Updated dependencies [8533cd6]
- Updated dependencies [e936068]
- Updated dependencies [edd2edc]
- Updated dependencies [e296877]
- Updated dependencies [9f78a6e]
- Updated dependencies [9f78a6e]
- Updated dependencies [9f78a6e]
- Updated dependencies [428fadd]
- Updated dependencies [1f74337]
- Updated dependencies [494c499]
- Updated dependencies [c5e2a21]
- Updated dependencies [d59e889]
- Updated dependencies [e936068]
- Updated dependencies [11545ce]
- Updated dependencies [645363d]
- Updated dependencies [e80794b]
- Updated dependencies [27f971d]
- Updated dependencies [9f78a6e]
- Updated dependencies [645363d]
- Updated dependencies [6b2a0fc]
- Updated dependencies [9f78a6e]
- Updated dependencies [8baa7d7]
- Updated dependencies [d06669c]
- Updated dependencies [decbcac]
- Updated dependencies [9befbcb]
- Updated dependencies [6c8ab94]
- Updated dependencies [bc6f0c7]
- Updated dependencies [676af7f]
- Updated dependencies [d9e04db]
- Updated dependencies [d6086e9]
- Updated dependencies [8be3d67]
- Updated dependencies [ebdc7bb]
- Updated dependencies [1f74337]
- Updated dependencies [9f78a6e]
- Updated dependencies [bd28bba]
- Updated dependencies [885030a]
- Updated dependencies [0d49804]
- Updated dependencies [27f971d]
  - @credo-ts/core@0.6.0
  - @credo-ts/openid4vc@0.6.0
  - @credo-ts/didcomm@0.6.0
  - @credo-ts/tenants@0.6.0
  - @credo-ts/drpc@0.6.0
  - @credo-ts/question-answer@0.6.0
  - @credo-ts/action-menu@0.6.0
  - @credo-ts/anoncreds@0.6.0
