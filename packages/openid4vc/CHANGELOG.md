# Changelog

## 0.6.0

### Minor Changes

- cd6c836: Adds support for chained authorization code flows within the OpenID4VCI credential issuance. This means that external authorization servers can be leveraged to authenticate or identify the user. The access token from this external authorization server can be then used during the issuance process in order to, for example, fetch credential data from an external resource server.
- 879ed2c: deprecate node 18
- 81dbbec: fix: typo statefull -> stateful in configuration of OpenID4VCI module
- 7e6e8f0: refactor(openid4vc): the OpenID4VC module now requires a top-level `app` property instead of a `router` for the `OpenId4VcVerifierModule` and `OpenId4VcIssuerModule`.

  Using the `app` directly simplifies the setup, as you don't have to register the routers at the correct paths anymore on your express app.

  We do recommend that you register your custom routes AFTER the Credo OpenID4VC routes have been registered, to ensure your custom middleware does not clash with Credo's routes.

  The reason for changing the router to an `app` is that we need to host files at the top-level `.well-known` path of the server, which is not easily doable with the custom router approach.

  If no app is provided, and the issuer or verifier module is enabled, a new app instance will be created.

- 1f74337: feat: support redirect_uri client id prefix for openid4vp holder and verifier
- e936068: when signing in Credo, it is now required to always reference a key id. For DIDs this is extracted from the DidRecord, and for JWKs (e.g. in holder binding) this is extracted form the `kid` of the JWK. For X509 certificates you need to make sure there is a key id attached to the certificate manually for now, since we don't have a X509 record like we have a DidRecord. For x509 certificates created before 0.6 you can use the legacy key id (`certificate.keyId = certificate.publicJwk.legacyKeyId`), for certificates created after 0.6 you need to manually store the key id and set it on the certificate after decoding.

  For this reason, we now require instances of X509 certificates where we used to require encoded certificates, to allow you to set the keyId on the certificate beforehand.

- 9f78a6e: feat(openid4vc): openid4vp alpha
- 5f08bc6: feat: allow dynamicaly providing x509 certificates for all types of verifications
- 9f78a6e: resolveIssuanceAuthorizationRequest has been renamed to resolveOpenId4VciAuthorizationRequest
- e936068: The `Key` and `Jwk` classes have been removed in favour of a new `PublicJwk` class, and all APIs in Credo have been updated to use the new `PublicJwk` class. Leveraging Jwk as the base for all APIs provides more flexility and makes it easier to support key types where it's not always so easy to extract the raw public key bytes. In addition all the previous Jwk relatedfunctionality has been replaced with the new KMS jwk functionalty. For example `JwaSignatureAlgorithm` is now `Kms.KnownJwaSignatureAlgorithms`.
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

- 9f78a6e: feat(openid4vc): add support for new dcql query syntax for oid4vp
- e936068: The wallet API has been completely rewritten to be more generic, support multiple backends at the same time, support generic encrypting and decryption, support symmetric keys, and enable backends that use key ids rather than the public key to identify a key. This has resulted in significant breaking changes, and all usages of the wallet api should be updated to use the new `agent.kms` APIs. In addition the wallet is not available anymore on the agentContext. If you used this, instead inject the KMS API using `agentContext.resolve(Kms.KeyManagementApi)`.
- 290ff19: use dc+sd-jwt as SD-JWT VC typ header by default and verify that SD-JWT VCs have either dc+sd-jwt or vc+sd-jwt as typ header. You can still use vc+sd-jwt as typ header by providing the headerType value when signing an SD-JWT VC. For OID4VCI the typ header is based on the oid4vci credential format used.
- 9f78a6e: refactor: Support for SIOPv2 has been removed and all interfaces and classes that included Siop in the name (such as OpenId4VcSiopHolderService) have been renamed to OpenId4Vp (so OpenId4VpHolderService)
- 70c849d: update target for tsc compiler to ES2020. Generally this should not have an impact for the supported environments (Node.JS / React Native). However this will have to be tested in React Native
- 8baa7d7: changed the `v1.draft11-13` and `v1.draft13` versions for credential offers to `v1.draft11-15` and `v1.draft15`. `v1.draft15` is compatible with draft 13, but you're responsible for correctly configuring the credential configurations supported.
- cfc2ac4: Added support for Draft 16 of the OpenID for Verifiable Credential Issuance, including deferred credential issuance. Please note that the deferred credential issuance is only supported as described by Draft 16.
- 81e3571: BREAKING CHANGE:

  `label` and `connectionImageUrl` have been dropped from Agent configuration. Therefore, it must be specified manually in all DIDComm connection establishment related methods. If you don't want to specify any label, just use an empty value.

  In the particular case of mediation provisioning through a `mediatorInvitationUrl`, the label will be always set to an empty value ('').

- 17ec6b8: feat(openid4vc): oid4vci authorization code flow, presentation during issuance and batch issuance.

  This is a big change to OpenID4VCI in Credo, with the neccsary breaking changes since we first added it to the framework. Over time the spec has changed significantly, but also our understanding of the standards and protocols.

  **Authorization Code Flow**
  Credo now supports the authorization code flow, for both issuer and holder. An issuer can configure multiple authorization servers, and work with external authorization servers as well. The integration is based on OAuth2, with several extension specifications, mainly the OAuth2 JWT Access Token Profile, as well as Token Introspection (for opaque access tokens). Verification works out of the box, as longs as the authorization server has a `jwks_uri` configured. For Token Introspection it's also required to provide a `clientId` and `clientSecret` in the authorization server config.

  To use an external authorization server, the authorization server MUST include the `issuer_state` parameter from the credential offer in the access token. Otherwise it's not possible for Credo to correlate the authorization session to the offer session.

  The demo-openid contains an example with external authorization server, which can be used as reference. The Credo authorization server supports DPoP and PKCE.

  **Batch Issuance**
  The credential request to credential mapper has been updated to support multiple proofs, and also multiple credential instances. The client can now also handle batch issuance.

  **Presentation During Issuance**
  The presenation during issuance allows to request presentation using OID4VP before granting authorization for issuance of one or more credentials. This flow is automatically handled by the `resolveAuthorizationRequest` method on the oid4vci holder service.

- 8533cd6: - Adds support for working with W3C VCDM 2.0 credentials secured with JWTs (`vc+jwt`) and SD-JWTs (`vc+sd-jwt`).
  - Adds support for issuing and presenting W3C VCDM 2.0 SD-JWTs (`vc+sd-jwt`) with the OpenID for Verifiable Credentials protocol.
  - Updates the identifier of the SD-JHT format from `vc+sd-jwt` to `dc+sd-jwt` to be in line with Version 1 of the OpenID for Verifiable Presentations specification.
- 9f78a6e: OpenID4VP draft 24 is supported along with transaction data, DCQL, and other features. This has impact on the API, but draft 21 is still supported by providing the `version` param when creating a request
- 9f78a6e: the default value for `responseMode` has changed from `direct_post` (unencrypted) to `direct_post.jwt` (encrypted)
- 9f78a6e: fixed an issue where expectedUpdate in an mdoc would be set to undefined. This is a breaking change as previously issued mDOCs containing expectedUpdate values of undefined are not valid anymore, and will cause issues during verification
- 428fadd: Uses the correct credential structure in (Deferred) Credential Responses when using Draft 15+ of the OpenID for Verifiable Credential Issuance specification.

  This means that Draft 15 is fully incompatible with previous drafts. As a consequence, the `version` option when creating a new offer credential has been changed to reflect that.

- 1f74337: feat: support multiple presentations for OpenID4VP presentations with DCQL. This is only supported when the query allows 'multiple'. Due to this the API has now changed from a single presentation per query id, to an array of credential ids with at least one entry.
- 9f78a6e: refactor: changed the DIF Presentation Exchnage returned credential entry `type` to `claimFormat` to better align with the DC API. In addition the selected credentials type for DIF PEX was changes from an array of credential records, to an object containig the record, claimFormat and disclosed payload
- 8baa7d7: add support for OID4VCI draft 15, including wallet and key attestations. With this we have made changes to several APIs to better align with key attestations, and how credential binding resolving works. Instead of calling the holder binding resolver for each credential that will be requested once, it will in total be called once and you can return multiple keys, or a single key attestation. APIs have been simplified to better align with changes in the OID4VCI protocols, but OID4VCI draft 11 and 13 are still fully supported. Support for dc+sd-jwt format has also been added. Note that there have been incompatible metadata display/claim changes in the metadata structure between draft 14 and 15 and thus if you want to support both draft 15 and older drafts you have to make sure you're handling this correctly (e.g. by creating separate configurations to be used with draft 13 or 15), and make sure you're using dc+sd-jwt with draft and vc+sd-jwt with draft 13.
- decbcac: The mdoc device response now verifies each document separately based on the trusted certificates callback. This ensures only the trusted certificates for that specific document are used. In addition, only ONE document per device response is supported for openid4vp verifications from now on, this is expected behaviour according to ISO 18013-7
- bc6f0c7: Add support for ESM module syntax.

  - Use `tsdown` to bundle for ESM -> tsdown is based on rust, so it should help with performance
  - Update to `vitest` since jest doesn't work well with ESM -> this should also help with performance
  - Simplify type checking -> just a single type check script instead of one for all packages. This should help with performance.

  NOTE: Since React Native bundles your code, the update to ESM should not cause issues. In addition all latest minor releases of Node 20 and 22 now support requiring ESM modules. This means that even if you project is still a CommonJS project, it can now depend on ESM modules. For this reason Credo is now fully an ESM module.

  Initially we added support for both CJS and ESM in parallel. However this caused issues with some libraries requiring the CJS output, and other the ESM output. Since Credo is only meant to be installed a single time for the dependency injection to work correctly, this resulted in unexpected behavior.

- d9e04db: Update to Express JS v5. If you're using the DIDComm Http transports, or the OpenID4VC issuer and verifier packages you should update to Express v5
- ebdc7bb: The openid4vc modules have been merged into a single module for easier setup.

  You can now add the `OpenId4VcModule` to your agent and config the `issuer` and `verifier` config on it. If the config for `issuer` or `verifier` is enabled, that submodule will be activated, and can be accessed on the API of the OpenId4VcModule.

  For convencience we now also expose the openid4vc module under the `openid4vc` property directly on the agent (instead of under `agent.modules`), but only if the module is registered under the `openid4vc` module key.

  For example if before you were using `agent.modules.openId4VcIssuer.xxx` you can now write this as `agent.openid4vc.issuer.xxx` after upgrading to the combined `OpenId4VcModule`. The old modules are still availalbe, but you should remove these from your module regisration in favour of the new `OpenId4VcModule`.

- 1f74337: feat: support OpenID4VP 1.0
- 9f78a6e: support for creating authorization requests based on `x509_san_uri` client id scheme has been removed. The holder services still support the client id scheme. The client id scheme is removed starting from draft 25 (and replaced with x509_hash, which will be supported in a future version), and is incompatible with the new url structure of Credo.

### Patch Changes

- 8dc1156: feat: supported `redirect_uri` for openid4vp response
- a888c97: Fix the return type of the credential mappers.
- 2cace9c: The following modules are not experimental anymore:
  - `DcqlModule`
  - `DifPresentationExchangeModule`
  - `SdJwtVcModule`
  - `MdocModule`
  - `TenantsModule`
  - `CheqdModule`
  - `DrpcModule`
  - `OpenId4VcModule`
  - `X509Module`
- 66d3384: Added feature to add a verifyAuthorizationCallback as the holder to do additional validation on the authorization request when resolving it
- a64ada0: Add support for refresh tokens in the context of the OpenID4VC, which can be used for deferred credential issuance.
- 8a816d8: Bump `oid4vc-ts` package to fix issues when converting credential issuer metadata to newer drafts.
- 568cc13: fix(openid4vc): Dynamic VP format support not correctly mapping ldp_vc
- 13cd8cb: feat: support node 22
- 6f3f621: Use base64 instead of base64url for encoding JWS `x5c` headers
- 95e9f32: fix: check supported key types for dpop, to ensure the registered KMS actually supports the key type that will be used
- 589a16e: Revert the verifyAuthorizationCallback. Should be called outside of the framework
- 17ec6b8: fix(openid4vc): use `vp_formats` in client_metadata instead of `vp_formats supported` (#2089)
- fccb5ab: Fixes an issue where an access token could not be retrieved more than once due to mismanagement of the issuance session state.
- 607659a: feat: fetch sd-jwt type metadata
- fee0260: Fix: correctly transform date on `OpenId4VcIssuanceSessionRecord`.
- 90caf61: feat: support mdoc device response containing multiple documents for OpenID4VP presentation
- 0500765: The OpenID4VCI holder service now returns a single credential record per credential request containing all the instances:

  - Credential records are pre-populated with KMS key IDs used during issuance
  - The holder can store received batch credentials using the `store()` method on the appropriate credential record API (`sdJwtVc`, `mdoc`, `w3cCredentials`, `w3cV2Credentials`)

  ```typescript
  const credentialResponse = await agent.openid4vc.holder.requestCredentials({
    // ...
  });

  // Store all received credentials
  for (const credential of credentialResponse.credentials) {
    if (credential.record instanceof W3cCredentialRecord) {
      await agent.w3cCredentials.store({ record: credential.record });
    }
    // Handle other credential types...
  }
  ```

- 17ec6b8: feat(openid4vc): support jwk thumbprint for openid token issuer
- c57cece: Added optional verifier_attestations when creating an authorization request as a verifier
- 0c274fe: feat: support Ed25519 as an algorithm identifier for JWA
- 468e9b4: Add custom import for express in the browser
- a4bdf6d: Fallback to anonymous authentication when doing client authentication with refresh token endpoint.
- 494c499: Fix the parsing of the claims field in the issuer metadata.
- 645363d: feat: add support for creating and hosting signed credential issuer metadata
- 27f971d: fix: only include supported mdoc algs in vp_formats metadata
- 645363d: feat: support x509_hash client id prefix when making openid4vp requests
- 6b2a0fc: fix: add missing return in resolvedAccessTokenPublicJwk getter
- d6086e9: Export a few utils used by dependents.
- 885030a: Bump the `oid4vc` packages to solve issues when parsing deferred credential responses.
- Updated dependencies [55318b2]
- Updated dependencies [e936068]
- Updated dependencies [43148b4]
- Updated dependencies [2d10ec3]
- Updated dependencies [6d83136]
- Updated dependencies [312a7b2]
- Updated dependencies [1495177]
- Updated dependencies [2cace9c]
- Updated dependencies [879ed2c]
- Updated dependencies [297d209]
- Updated dependencies [2312bb8]
- Updated dependencies [11827cc]
- Updated dependencies [9f78a6e]
- Updated dependencies [297d209]
- Updated dependencies [0500765]
- Updated dependencies [bea846b]
- Updated dependencies [13cd8cb]
- Updated dependencies [2cace9c]
- Updated dependencies [15acc49]
- Updated dependencies [df7580c]
- Updated dependencies [e936068]
- Updated dependencies [16f109f]
- Updated dependencies [e936068]
- Updated dependencies [617b523]
- Updated dependencies [90caf61]
- Updated dependencies [e936068]
- Updated dependencies [dca4fdf]
- Updated dependencies [14673b1]
- Updated dependencies [0c274fe]
- Updated dependencies [2cace9c]
- Updated dependencies [607659a]
- Updated dependencies [44b1866]
- Updated dependencies [5f08bc6]
- Updated dependencies [27f971d]
- Updated dependencies [cacd8ee]
- Updated dependencies [e936068]
- Updated dependencies [2d10ec3]
- Updated dependencies [0500765]
- Updated dependencies [1a4182e]
- Updated dependencies [8be3d67]
- Updated dependencies [90caf61]
- Updated dependencies [9f78a6e]
- Updated dependencies [e936068]
- Updated dependencies [290ff19]
- Updated dependencies [8baa7d7]
- Updated dependencies [decbcac]
- Updated dependencies [9df09fa]
- Updated dependencies [2cace9c]
- Updated dependencies [70c849d]
- Updated dependencies [0c274fe]
- Updated dependencies [897c834]
- Updated dependencies [a53fc54]
- Updated dependencies [81e3571]
- Updated dependencies [9ef54ba]
- Updated dependencies [8533cd6]
- Updated dependencies [e936068]
- Updated dependencies [edd2edc]
- Updated dependencies [e296877]
- Updated dependencies [9f78a6e]
- Updated dependencies [1f74337]
- Updated dependencies [c5e2a21]
- Updated dependencies [d59e889]
- Updated dependencies [e936068]
- Updated dependencies [645363d]
- Updated dependencies [e80794b]
- Updated dependencies [9f78a6e]
- Updated dependencies [9f78a6e]
- Updated dependencies [8baa7d7]
- Updated dependencies [decbcac]
- Updated dependencies [6c8ab94]
- Updated dependencies [bc6f0c7]
- Updated dependencies [8be3d67]
- Updated dependencies [bd28bba]
- Updated dependencies [0d49804]
- Updated dependencies [27f971d]
  - @credo-ts/core@0.6.0

## 0.5.13

### Patch Changes

- 595c3d6: feat: mdoc device response and presentation over oid4vp
- Updated dependencies [595c3d6]
  - @credo-ts/core@0.5.13

## 0.5.12

### Patch Changes

- 1d83159: feat: add jarm-support
- Updated dependencies [3c85565]
- Updated dependencies [3c85565]
- Updated dependencies [7d51fcb]
- Updated dependencies [9756a4a]
  - @credo-ts/core@0.5.12

## 0.5.11

### Patch Changes

- 6c2dd88: add support for cose_key as cryptographic_binding_methods_supported value
  - @credo-ts/core@0.5.11

## 0.5.10

### Patch Changes

- 2110e4a: fix: incorrect generation of code verifier for pkce
- 2110e4a: fix: include client_id when requesting credential using authorization_code flow
- 35a04e3: fix v11 metadata typing and update v11<->v13 tranformation logic accordingly
- fa62b74: Add support for Demonstrating Proof of Possesion (DPoP) when receiving credentials using OpenID4VCI
- a093150: fix: pass the `clientId` in the `requestCredentials` method from the API down to the service
- Updated dependencies [fa62b74]
  - @credo-ts/core@0.5.10

## 0.5.9

### Patch Changes

- a12d80c: feat: update to openid4vc v1 draft 13, with v11 compatibility
  - @credo-ts/core@0.5.9

## 0.5.8

### Patch Changes

- 3819eb2: Adds support for issuance and verification of SD-JWT VCs using x509 certificates over OpenID4VC, as well as adds support for the `x509_san_uri` and `x509_san_dns` values for `client_id_scheme`. It also adds support for OpenID4VP Draft 20
- Updated dependencies [3819eb2]
- Updated dependencies [15d0a54]
- Updated dependencies [a5235e7]
  - @credo-ts/core@0.5.8

## 0.5.7

### Patch Changes

- 2173952: Fix an issue where `express` was being bundled in React Native applications even though the `OpenId4VcIssuerModule` and `OpenId4VcVerifierModule` were not used, causing runtime errors.
- Updated dependencies [352383f]
- Updated dependencies [1044c9d]
  - @credo-ts/core@0.5.7

## 0.5.6

### Patch Changes

- 66e696d: Fix build issue causing error with importing packages in 0.5.5 release
- Updated dependencies [66e696d]
  - @credo-ts/core@0.5.6

## 0.5.5

### Patch Changes

- 482a630: - feat: allow serving dids from did record (#1856)
  - fix: set created at for anoncreds records (#1862)
  - feat: add goal to public api for credential and proof (#1867)
  - fix(oob): only reuse connection if enabled (#1868)
  - fix: issuer id query anoncreds w3c (#1870)
  - feat: sd-jwt issuance without holder binding (#1871)
  - chore: update oid4vci deps (#1873)
  - fix: query for qualified/unqualified forms in revocation notification (#1866)
  - fix: wrong schema id is stored for credentials (#1884)
  - fix: process credential or proof problem report message related to connectionless or out of band exchange (#1859)
  - fix: unqualified indy revRegDefId in migration (#1887)
  - feat: verify SD-JWT Token status list and SD-JWT VC fixes (#1872)
  - fix(anoncreds): combine creds into one proof (#1893)
  - fix: AnonCreds proof requests with unqualified dids (#1891)
  - fix: WebSocket priority in Message Pick Up V2 (#1888)
  - fix: anoncreds predicate only proof with unqualified dids (#1907)
  - feat: add pagination params to storage service (#1883)
  - feat: add message handler middleware and fallback (#1894)
- Updated dependencies [3239ef3]
- Updated dependencies [d548fa4]
- Updated dependencies [482a630]
  - @credo-ts/core@0.5.5

## [0.5.3](https://github.com/openwallet-foundation/credo-ts/compare/v0.5.2...v0.5.3) (2024-05-01)

**Note:** Version bump only for package @credo-ts/openid4vc

## [0.5.2](https://github.com/openwallet-foundation/credo-ts/compare/v0.5.1...v0.5.2) (2024-04-26)

### Bug Fixes

- access token can only be used for offer ([#1828](https://github.com/openwallet-foundation/credo-ts/issues/1828)) ([f54b90b](https://github.com/openwallet-foundation/credo-ts/commit/f54b90b0530b43a04df6299a39414a142d73276e))
- oid4vp can be used separate from idtoken ([#1827](https://github.com/openwallet-foundation/credo-ts/issues/1827)) ([ca383c2](https://github.com/openwallet-foundation/credo-ts/commit/ca383c284e2073992a1fd280fca99bee1c2e19f8))
- **openid4vc:** update verified state for more states ([#1831](https://github.com/openwallet-foundation/credo-ts/issues/1831)) ([958bf64](https://github.com/openwallet-foundation/credo-ts/commit/958bf647c086a2ca240e9ad140defc39b7f20f43))

### Features

- add disclosures so you know which fields are disclosed ([#1834](https://github.com/openwallet-foundation/credo-ts/issues/1834)) ([6ec43eb](https://github.com/openwallet-foundation/credo-ts/commit/6ec43eb1f539bd8d864d5bbd2ab35459809255ec))
- apply new version of SD JWT package ([#1787](https://github.com/openwallet-foundation/credo-ts/issues/1787)) ([b41e158](https://github.com/openwallet-foundation/credo-ts/commit/b41e158098773d2f59b5b5cfb82cc6be06a57acd))
- openid4vc issued state per credential ([#1829](https://github.com/openwallet-foundation/credo-ts/issues/1829)) ([229c621](https://github.com/openwallet-foundation/credo-ts/commit/229c62177c04060c7ca4c19dfd35bab328035067))

## [0.5.1](https://github.com/openwallet-foundation/credo-ts/compare/v0.5.0...v0.5.1) (2024-03-28)

### Bug Fixes

- **openid4vc:** several fixes and improvements ([#1795](https://github.com/openwallet-foundation/credo-ts/issues/1795)) ([b83c517](https://github.com/openwallet-foundation/credo-ts/commit/b83c5173070594448d92f801331b3a31c7ac8049))

# [0.5.0](https://github.com/openwallet-foundation/credo-ts/compare/v0.4.2...v0.5.0) (2024-03-13)

### Features

- anoncreds w3c migration ([#1744](https://github.com/openwallet-foundation/credo-ts/issues/1744)) ([d7c2bbb](https://github.com/openwallet-foundation/credo-ts/commit/d7c2bbb4fde57cdacbbf1ed40c6bd1423f7ab015))
- **openid4vc:** persistance and events ([#1793](https://github.com/openwallet-foundation/credo-ts/issues/1793)) ([f4c386a](https://github.com/openwallet-foundation/credo-ts/commit/f4c386a6ccf8adb829cad30b81d524e6ffddb029))
