# Changelog

## 0.8.0

### Minor Changes

- 526a989: Drop support for Node.js 20, which reached end-of-life. The minimum supported Node.js version is now 22.
- fb968ea: The KMS now creates the ECDH ephemeral key itself and never stores it. `encrypt` returns its public key as `ephemeralPublicJwk`. `ECDH-ES` and `ECDH-ES+KW` no longer take a `keyId`, and passing one now fails validation. In `encrypt`, a `keyId` in `keyAgreement` now always means the sender's key.
  
  `encryption.aad` can now be a callback that gets the `ephemeralPublicJwk` and returns the AAD, so you can put the `epk` in a JWE protected header. This is only allowed with `ECDH-ES`, `ECDH-ES+KW` and `ECDH-1PU+A256KW`. These now only allow authenticated content encryption in both `encrypt` and `decrypt`, and `encrypt` no longer takes an `iv` for them.
  
  Askar no longer reports `ECDH-ES` with `A256CBC-HS512` as supported, as its key derivation can't produce the 64 byte key. Agents that also register the Node backend now encrypt it with Node.
  
  ```ts
  // before
  const ephemeralKey = await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
  const header = JsonEncoder.toBase64Url({ alg: 'ECDH-ES', enc: 'A256GCM', epk: ephemeralKey.publicJwk })
  const { encrypted, iv, tag } = await agent.kms.encrypt({
    key: { keyAgreement: { algorithm: 'ECDH-ES', keyId: ephemeralKey.keyId, externalPublicJwk: recipientJwk } },
    encryption: { algorithm: 'A256GCM', aad: TypedArrayEncoder.fromUtf8String(header) },
    data,
  })
  await agent.kms.deleteKey({ keyId: ephemeralKey.keyId })
  
  // after
  let header: string | undefined
  const { encrypted, iv, tag } = await agent.kms.encrypt({
    key: { keyAgreement: { algorithm: 'ECDH-ES', externalPublicJwk: recipientJwk } },
    encryption: {
      algorithm: 'A256GCM',
      aad: ({ ephemeralPublicJwk }) => {
        header = JsonEncoder.toBase64Url({ alg: 'ECDH-ES', enc: 'A256GCM', epk: ephemeralPublicJwk })
        return TypedArrayEncoder.fromUtf8String(header)
      },
    },
    data,
  })
  ```
- fb968ea: KMS `encrypt` can now wrap the content key for more than one recipient. `ECDH-ES+A128KW`, `ECDH-ES+A192KW`, `ECDH-ES+A256KW` and the new `ECDH-1PU+A256KW` take a `recipients` array instead of `externalPublicJwk`, and return `encryptedKeys` in the same order. All recipients must use the same key type and curve, since they share one ephemeral key. The single `encryptedKey` is removed from the result.
  
  The Askar and Node backends support `ECDH-1PU+A256KW`, which needs an `A*CBC-HS*` content encryption algorithm in both `encrypt` and `decrypt`. `supportedBackendsForOperation` returns no backends for content encryption that `encrypt` or `decrypt` rejects.
  
  ```ts
  const { encrypted, iv, tag, ephemeralPublicJwk, encryptedKeys } = await agent.kms.encrypt({
    key: {
      keyAgreement: {
        algorithm: 'ECDH-1PU+A256KW',
        keyId: senderKeyId,
        recipients: [{ externalPublicJwk: aliceJwk }, { externalPublicJwk: bobJwk }],
      },
    },
    encryption: { algorithm: 'A256CBC-HS512' },
    data,
  })
  ```
- b21bba5: HTTP requests now have a response size limit and a timeout, so a malicious server can't exhaust memory or keep a request open. The agent wraps `agentDependencies.fetch` with the new `fetchLimits` agent config, which defaults to 10 MiB and 30 seconds. This also covers requests that libraries make with it, such as OpenID4VC and mdoc requests. A response over the limit is aborted and its request fails.
  
  These options override `maxResponseBytes` for specific requests:
  
  - `maxTypeMetadataBytes` on `SdJwtVcModule` for type metadata.
  - `maxStatusListBytes` on the new `TokenStatusListModule` config for status lists of Token Status Lists, SD-JWT VCs and mdocs.
  - `maxDidDocumentBytes` on `WebDidResolver`.
  - `maxResourceBytes` on `WebVhDidResolver`.
  - `maxResponseBytes` on `DidCommHttpOutboundTransport`.
  - `maxInvitationBytes` on `DidCommModule` for short URL invitations.
  
  The download stops at the limit when the `fetch` in the agent dependencies exposes the response body as a stream. On React Native, recent Expo versions use `expo/fetch` as the global fetch, which supports this. React Native's built-in fetch doesn't: it only returns a response after the whole body is downloaded. A response over the limit then still fails, but it doesn't protect memory. We recommend `expo/fetch`, or another fetch implementation that supports streaming.
  
  When `DidCommWsInboundTransport` creates the server from `port`, it now limits received messages to 5 MiB, the same as `DidCommHttpInboundTransport`. Before, the limit was 100 MiB, the default of `ws`. A larger message now closes the socket. Agents that receive larger messages, for example a mediator receiving `forward` messages with large attachments, can raise the limit with the new `maxPayloadBytes` option. When you pass your own `server`, set `maxPayload` on it yourself.
- 194cf1e: Make published TypeScript declarations resolvable without development dependencies. Move `@types/events` to dependencies in `@credo-ts/core`, and `@types/node` and `@types/ws` to dependencies in `@credo-ts/node`. Replace non-portable and self-referential imports in core, and use `AgentDependencies` for the WebSocket type in `@credo-ts/didcomm` instead of importing from undeclared `ws`.

### Patch Changes

- 3985e5b: Add DIDComm v2 ([DIDComm Messaging v2.1](https://identity.foundation/didcomm-messaging/spec/v2.1/)) next to DIDComm v1. Support for v2 is opt-in: `didcommVersions` defaults to `['v1']`, and an agent without v2 rejects v2 envelopes and keeps its v1 behaviour. An agent with both versions talks v1 and v2 at the same time. The version of a connection is stored on the connection record, so existing v1 connections keep working and new connections use the version of the invitation they come from. The public API has no breaking changes: all v2 additions are new types, members, options or overloads next to the existing ones.
  
  ```ts
  const agent = new Agent({
    modules: {
      didcomm: new DidCommModule({
        didcommVersions: ['v1', 'v2'],
        // optional, these are the defaults
        v2KeyAgreementCurve: 'X25519', // or 'P-256' | 'P-384'
        v2DefaultAuthcryptContentEncryption: 'A256CBC-HS512',
        v2DefaultAnoncryptContentEncryption: 'A256CBC-HS512', // or 'A256GCM' | 'XC20P'
        peerDidNumAlgoForV2OOB: PeerDidNumAlgo.ShortFormAndLongForm, // did:peer:4
        basicMessages: { protocols: ['v1', 'v2'] },
      }),
      connections: new DidCommConnectionsModule({ autoCreateConnectionOnFirstMessage: true }),
      mediationRecipient: new DidCommMediationRecipientModule({ mediationProtocolVersions: ['v1', 'v2'] }),
      mediator: new DidCommMediatorModule({ mediationProtocolVersions: ['v1', 'v2'] }),
    },
  })
  
  const { outOfBandInvitation } = await agent.didcomm.oob.createInvitation({ didCommVersion: 'v2' })
  ```
  
  `@credo-ts/didcomm`:
  
  - Envelopes: `DidCommV2EnvelopeService` packs and unpacks authcrypt (`ECDH-1PU+A256KW` with `A256CBC-HS512`) and anoncrypt (`ECDH-ES+A256KW` with `A256CBC-HS512`, `A256GCM` or `XC20P`) JWEs in general JSON serialization with `apu`/`apv`, for X25519, P-256 and P-384 key agreement, and verifies signed messages (`application/didcomm-signed+json` with EdDSA, ES256 or ES256K), also when they are nested in an encrypted message. The `DidCommEnvelope` interface with `DidCommV1Envelope`, `DidCommV2Envelope` and the `DidCommEnvelopeRegistry` picks the version per message: the version of the inbound session, else the version of the connection, else v1. Outbound messages are always authcrypt, except forwards, which are anoncrypt. Credo's X25519 keys are independent keys and are no longer derived from Ed25519 keys.
  - Message handling: v2 plaintext messages are converted to the v1 shape (`@id`, `@type`, `~thread`, `~attach`, `~timing`, `~transport`) before they reach the handlers, and back when they are sent, so protocol implementations are version-agnostic. Message classes can shape their own v2 headers and body. Inbound v2 messages are matched to a connection by the `to`/`from` DID pair, then by `theirDid`, by keys, or by a `from_prior` issuer or a verified `alsoKnownAs` alias. Replies over a transport session use the version of the inbound message. Problem reports use report-problem/2.0 on v2 connections. Message ids and `pthid` accept 1 to 64 characters including `~`.
  - Connections and out-of-band: out-of-band 2.0 invitations (`DidCommOutOfBandInvitationV2`, `_oob` URL parameter, attachments). `createInvitation` takes `didCommVersion`, `peerDidNumAlgoForV2OOB` and `ourDid`; `receiveImplicitInvitation` takes `didCommVersion` and detects it from the DID document when omitted. v2 connections have no handshake (`DidCommHandshakeProtocol.None`): accepting the invitation creates a completed connection and the first message carries the invitation id as `pthid`. With `autoCreateConnectionOnFirstMessage` a first v2 message opens a connection, bound to the invitation named by `pthid` or to an implicit invitation (one of our public DIDs). Connection reuse works through `pthid` (`reuseForOutOfBandInvitation`). `DidCommConnectionRecord.didcommVersion` (`'v1' | 'v2'`) is also a queryable tag. DID rotation with `from_prior` and hangup (`connections.rotate()`, `connections.hangup()`) work on v2 connections.
  - Protocols over v2: Trust Ping 2.0, Basic Message 2.0 (`basicMessages: { protocols }`), Discover Features 2.0, Routing 2.0 (`forward`), Coordinate Mediation 2.0, Message Pickup 4.0 (`PickUpV4` and `PickUpV4LiveMode` strategies), Report Problem 2.0 and the empty message. Connection request and response (DID Exchange) stay v1. Out of Band 2.0, Message Pickup 4.0 and `empty/1.0` are registered and advertised in discover-features only when v2 is enabled.
  - Mediation: Coordinate Mediation 2.0 on both sides (mediate-request/grant/deny, keylist-update, keylist-query with pagination, `routing_did` in the grant). `mediationProtocolVersions` defaults to `['v1']` on the recipient and mediator modules. The mediator publishes a routing DID (`mediatorRoutingDid`, or a did:peer:2 built from its routing record) and adds an X25519 routing key to its routing record when v2 is enabled. The pickup strategy follows the mediation version (4.0 on CM 2.0, 2.0 on CM 1.0). v1 peers reach a recipient behind a CM 2.0 mediator: a `did-communication` service whose endpoint is a routing DID is expanded to the mediator endpoint and its routing keys. `DidCommRouting` gains the optional `keyAgreementKey` and `routingDid`. `DidCommMediationRecord` gains `routingDid`, `recipientDids` and `protocolVersion`. `notifyKeylistUpdate` has a new overload `(mediationRecord, recipientKeyOrDid, action?)`.
  - `DidCommInboundMessageContext` gains the optional `recipientDid`, `senderKeyAgreementKey` and `recipientKeyAgreementKey`; `senderKey` and `recipientKey` stay Ed25519 keys. `DidCommMessagePickupModule` defaults `protocols` to v1, v2 and v4; v4 is skipped when v2 is not enabled. `DidCommMessageSender` and `DidCommMessageReceiver` take the `DidCommEnvelopeRegistry` in their constructors.
  
  Behaviour changes for agents that do not enable v2: the recipient-key fingerprints of a DID document that advertises a `DIDCommMessaging` service include its `keyAgreement` keys (stored records keep their tags until they are saved again), a v1 forward is also matched by the recipient DID, a `did-communication` service with a DID endpoint is expanded, and HTTP inbound content types are matched case-insensitively and without parameters. When v2 is enabled, `oob.createInvitation()` without v1-only options (`handshakeProtocols`, `messages`, `appendedAttachments`, `routing`) creates a v2 invitation; pass `didCommVersion: 'v1'` to keep v1.
  
  `@credo-ts/core`:
  
  - `DidDocument` gains `didCommV2Services`, `allDidCommRecipientKeys` (the v1 recipient keys plus the `keyAgreement` keys of a document with a v2 service) and `getKeyAgreementRecipientKeysWithVerificationMethod()`. `didCommServices`, `recipientKeys` and `getRecipientKeysWithVerificationMethod()` keep their v1 content.
  - `DidRecord.recipientKeyFingerprints` and the `recipientKeyFingerprints` tag of created DIDs are built from `allDidCommRecipientKeys`, so a DID with a v2 service is also found by its `keyAgreement` keys.
  - `utils.uuidFromName`, `didToNumAlgo2DidDocument`, `didToNumAlgo4DidDocument`, `areEquivalentDidPeer4Forms`, `getDidPeer4ShortFormForEquivalence`, `isShortFormDidPeer4` and `getAlternativeDidsForNumAlgo4Did` are exported. `PublicJwk.is()` accepts up to four types.
  
  `@credo-ts/node`:
  
  - `DidCommHttpInboundTransport` accepts `application/didcomm-encrypted+json` and `application/didcomm-signed+json` when v2 is enabled, and answers with the v2 media type when the reply is a v2 envelope.
  
  Askar and in-memory storage need no migration, all new record fields are optional. Drizzle storage needs the `didcomm` bundle migrations, see the `@credo-ts/drizzle-storage` changelog.
- fbb6517: Allow HTTP DIDComm routes to be hosted on an externally managed Express application and make listener startup failures observable.
- 82a6efd: Update the TypeScript development dependency to TypeScript 7 (`typescript@^7.0.2`, installed as `@typescript/native`) for type checking. The `typescript` package is now an alias of `@typescript/typescript6@^6.0.2`, so tools that use the TypeScript compiler API, such as `tsdown` when generating declaration files, keep working.
  
  This has no effect on runtime behaviour. `getPublicJwkFromDid` in `@credo-ts/openid4vc` now declares its `Promise<PublicJwk>` return type, which is the type it already returned.
- 2eb0806: AES-GCM decryption in the Node key management service now requires a 16-byte authentication tag. Before, it also accepted truncated tags of 4 to 15 bytes.
- a702ce8: The HTTP inbound transport now answers `202 Accepted` instead of `200 OK` when a received DIDComm message is processed without a response message travelling back over the same HTTP connection, as DIDComm Messaging recommends. A response message is still returned with `200 OK`.
- e3788dc: ECDH-ES with `A192GCM` content encryption in the node KMS now uses a 192 bit key, so it no longer fails.
- e3788dc: ECDH-ES in the node KMS now works with X25519 keys and with key wrapping, including 64 byte keys such as for `A256CBC-HS512`. P-384 and P-521 now derive keys with SHA-256 like other JOSE libraries, so data encrypted with the old node KMS on those curves won't decrypt.
- e3788dc: The node KMS now returns `Uint8Array` instead of `Buffer` from `randomBytes`, `sign`, `encrypt` and `decrypt`.
- 526a989: feat: support node 26
- Updated dependencies [457f5a6]
- Updated dependencies [c2bb4d5]
- Updated dependencies [0b9531a]
- Updated dependencies [c452dfc]
- Updated dependencies [2c4e3a2]
- Updated dependencies [798c401]
- Updated dependencies [b77a2c3]
- Updated dependencies [ee69f9d]
- Updated dependencies [8abea64]
- Updated dependencies [3564660]
- Updated dependencies [8a6af0b]
- Updated dependencies [7a1a5c9]
- Updated dependencies [33d3f53]
- Updated dependencies [93907de]
- Updated dependencies [f3d537a]
- Updated dependencies [de1c035]
- Updated dependencies [2485e36]
- Updated dependencies [51bd389]
- Updated dependencies [9eadcb8]
- Updated dependencies [1ee57f6]
- Updated dependencies [14e84ce]
- Updated dependencies [218237d]
- Updated dependencies [fac9757]
- Updated dependencies [95b0dd5]
- Updated dependencies [81265f5]
- Updated dependencies [b77a2c3]
- Updated dependencies [3d4b386]
- Updated dependencies [9105c2d]
- Updated dependencies [b51f8b5]
- Updated dependencies [75f7139]
- Updated dependencies [3985e5b]
- Updated dependencies [77fe670]
- Updated dependencies [dbde0f1]
- Updated dependencies [526a989]
- Updated dependencies [820d809]
- Updated dependencies [c452dfc]
- Updated dependencies [5cb5e46]
- Updated dependencies [3354c95]
- Updated dependencies [4dd128a]
- Updated dependencies [82a6efd]
- Updated dependencies [da2a293]
- Updated dependencies [a362176]
- Updated dependencies [b2ac66a]
- Updated dependencies [4c2f93b]
- Updated dependencies [dde35e0]
- Updated dependencies [1de1ead]
- Updated dependencies [fb968ea]
- Updated dependencies [fb968ea]
- Updated dependencies [fb968ea]
- Updated dependencies [820d809]
- Updated dependencies [716cb84]
- Updated dependencies [82a6efd]
- Updated dependencies [667c462]
- Updated dependencies [9303c90]
- Updated dependencies [87e9c1a]
- Updated dependencies [87e9c1a]
- Updated dependencies [1bbcdc3]
- Updated dependencies [e851280]
- Updated dependencies [3c27483]
- Updated dependencies [7fb55cc]
- Updated dependencies [cf46149]
- Updated dependencies [56516ee]
- Updated dependencies [4fed115]
- Updated dependencies [4b137e8]
- Updated dependencies [aadabc9]
- Updated dependencies [e930e66]
- Updated dependencies [ae0fe8e]
- Updated dependencies [ee69f9d]
- Updated dependencies [357a5da]
- Updated dependencies [0814729]
- Updated dependencies [2e13dd1]
- Updated dependencies [fb99743]
- Updated dependencies [b9c051d]
- Updated dependencies [526a989]
- Updated dependencies [25199e8]
- Updated dependencies [d086b7a]
- Updated dependencies [3678fb3]
- Updated dependencies [b21bba5]
- Updated dependencies [3354c95]
- Updated dependencies [0523bd0]
- Updated dependencies [0b7ba8d]
- Updated dependencies [2f20e2e]
- Updated dependencies [8a6af0b]
- Updated dependencies [8178149]
- Updated dependencies [b1090de]
- Updated dependencies [78d5cfb]
- Updated dependencies [7ba15bc]
- Updated dependencies [194cf1e]
- Updated dependencies [ac3b95b]
- Updated dependencies [ae0fe8e]
- Updated dependencies [64fec67]
- Updated dependencies [cbfe06b]
- Updated dependencies [47691c2]
- Updated dependencies [1ee57f6]
- Updated dependencies [faaf1e0]
- Updated dependencies [56ae9a6]
- Updated dependencies [47691c2]
- Updated dependencies [93907de]
- Updated dependencies [94faeed]
- Updated dependencies [dbbef02]
- Updated dependencies [faaf1e0]
- Updated dependencies [47691c2]
- Updated dependencies [8114e84]
- Updated dependencies [dbafd1e]
- Updated dependencies [2151443]
- Updated dependencies [c05145a]
- Updated dependencies [ad928f5]
- Updated dependencies [808e873]
- Updated dependencies [81265f5]
  - @credo-ts/didcomm@0.8.0
  - @credo-ts/core@0.8.0

## 0.7.1

### Patch Changes

- bc4638e: Add support for the ISO/IEC TS 18013-7:2025 Annex C (`org-iso-mdoc`) Digital Credentials API.
  
  - KMS: HPKE (RFC 9180) key agreement algorithms `HPKE-0`, `HPKE-3` and `HPKE-7`, following the naming of draft-ietf-jose-hpke-encrypt. These are integrated-encryption algorithms, so `encryption`/`decryption` must be omitted and `encrypt` returns an `encapsulatedKey`. Implemented in the askar backend (the recipient private key stays inside askar; only the Diffie-Hellman output leaves it) and in the node backend.
  - Mdoc module: `createDcApiVerificationSession` / `verifyDcApiResponse` for verifiers and `resolveDcApiRequest` / `createDcApiResponse` for wallets, backed by a new `MdocVerificationSessionRecord`.
  - `verifyDcApiResponse` matches the response against the device request of the session and throws a `MdocDeviceRequestNotSatisfiedError` when a doc request is not satisfied. By default every requested element must be disclosed and issuer signed; in the `docRequests` passed to `createDcApiVerificationSession`, pass `{ intentToRetain, optional, source }` instead of the `intentToRetain` boolean to mark an element as optional or as device signed. The match is returned as `deviceRequestMatch`, with per doc request the valid and failed documents, and per document the result of the `docType` and `claims` checks.
  - `resolveDcApiRequest` matches the stored mdocs with the same rules and returns the same structure (through `Holder.matchDeviceRequest` of `@owf/mdoc`): per doc request the `validCredentials` and `failedCredentials`, each with its `record` and the `docType` and `claims` checks, so a wallet can show an mdoc of the requested doctype together with the requested claims it is missing. An `age_over_NN` request is answered with the age attestation the mdoc has (18013-5 7.2.5). A requested element that is not issuer signed, but that the device key is authorized for in the MSO, is matched as device signed when its value is passed in `deviceNameSpaces` to `resolveDcApiRequest`: pass the same value in the `deviceNameSpaces` of the credential to `createDcApiResponse`. A credential can also pass `elements` to disclose only some of the requested elements.
  - Reader authentication on an incoming request is resolved through the same trust layers as credential verification: the certificates passed to `resolveDcApiRequest`, then the global `getTrustedIssuersForVerification` callback (with the new `mdocReaderAuth` verification type, called per doc request), then the deprecated `getTrustedCertificatesForVerification` callback, then the statically configured trusted certificates. Resolving a reader authenticated request throws when none of these are configured. Return the leaf certificate from the callback to trust a reader on the certificate it presented itself.
- bc4638e: Only pick a response encryption key from `client_metadata.jwks` that the key management backends of the agent can actually perform the `ECDH-ES` key agreement with. Previously the first recognized `enc` key was used, which failed later on if e.g. a verifier included a `P-521` key and the configured KMS backend (such as Askar) does not support that curve. The Askar and Node key management backends now also take the curve of the external public key into account in `isOperationSupported`.
- Updated dependencies [9f4278b]
- Updated dependencies [f127ff5]
- Updated dependencies [5cfcadb]
- Updated dependencies [84dfcf4]
- Updated dependencies [b75467c]
- Updated dependencies [e80900a]
- Updated dependencies [8ded8d2]
- Updated dependencies [fd5016d]
- Updated dependencies [d45aec0]
- Updated dependencies [5cfcadb]
- Updated dependencies [097c831]
- Updated dependencies [20d6ab1]
- Updated dependencies [bc4638e]
- Updated dependencies [bc4638e]
- Updated dependencies [bc4638e]
- Updated dependencies [907f12f]
- Updated dependencies [bc4638e]
- Updated dependencies [96dc69b]
- Updated dependencies [7dfafeb]
- Updated dependencies [3a3eb03]
- Updated dependencies [23c354e]
- Updated dependencies [907cc54]
- Updated dependencies [339f4cc]
- Updated dependencies [bc4638e]
- Updated dependencies [5cfcadb]
- Updated dependencies [f127ff5]
- Updated dependencies [cfe86fa]
- Updated dependencies [e97c18b]
- Updated dependencies [121dd14]
- Updated dependencies [b75467c]
- Updated dependencies [cfe86fa]
- Updated dependencies [0a58888]
- Updated dependencies [1e2088f]
  - @credo-ts/core@0.7.1
  - @credo-ts/didcomm@0.7.1

## 0.7.0

### Minor Changes

- cc65c27: - Removed buffer dependency and replaced with `@scure/base` for base-x encoding/decoding

  - Updated DIDComm attachments to use base64url, not base64
  - Updated tests to make sure urland base64 encoded items use base64url
  - Added `fromBase64Url` to `TypedArrayEncoder` and `JsonEncoder`

  Breaking changes:

  1. `TypedArrayEncoder.fromBase64` does not support base64url anymore, please use `TypedArrayEncoder.fromBase64Url` for that. Same for `JsonEncoder`
  2. `TypedArrayEncoder.fromString` has been replaced by `TypedArrayEncoder.fromUtf8String` to be consistent with `TypedArrayEncoder.toUtf8String`
  3. Every place where we accepted `Buffer` as input we now only support `Uint8Array` as input
  4. `TypedArrayEncoder.equals` is now constant-time, however I would still hesitate to use it for any private crypto operation 5. Removed `Uint8ArrayBuffer` type, not used anymore

### Patch Changes

- Updated dependencies [5056b97]
- Updated dependencies [b75f0bf]
- Updated dependencies [120cee8]
- Updated dependencies [c1ab9be]
- Updated dependencies [10a3ce5]
- Updated dependencies [10a3ce5]
- Updated dependencies [cc65c27]
- Updated dependencies [b7aec4e]
  - @credo-ts/core@0.7.0
  - @credo-ts/didcomm@0.7.0

## 0.6.3

### Patch Changes

- Updated dependencies [73d2d59]
  - @credo-ts/core@0.6.3
  - @credo-ts/didcomm@0.6.3

## 0.6.2

### Patch Changes

- Updated dependencies [b9bd214]
- Updated dependencies [69acbc3]
- Updated dependencies [4a4473c]
- Updated dependencies [2c15356]
- Updated dependencies [4989dd9]
- Updated dependencies [0f7171a]
- Updated dependencies [e441cc1]
- Updated dependencies [1969c67]
- Updated dependencies [620bb38]
- Updated dependencies [2073110]
- Updated dependencies [620bb38]
  - @credo-ts/core@0.6.2
  - @credo-ts/didcomm@0.6.2

## 0.6.1

### Patch Changes

- Updated dependencies [9f60e1b]
- Updated dependencies [251cbe5]
  - @credo-ts/core@0.6.1
  - @credo-ts/didcomm@0.6.1

## 0.6.0

### Minor Changes

- 879ed2c: deprecate node 18
- e936068: when signing in Credo, it is now required to always reference a key id. For DIDs this is extracted from the DidRecord, and for JWKs (e.g. in holder binding) this is extracted form the `kid` of the JWK. For X509 certificates you need to make sure there is a key id attached to the certificate manually for now, since we don't have a X509 record like we have a DidRecord. For x509 certificates created before 0.6 you can use the legacy key id (`certificate.keyId = certificate.publicJwk.legacyKeyId`), for certificates created after 0.6 you need to manually store the key id and set it on the certificate after decoding.

  For this reason, we now require instances of X509 certificates where we used to require encoded certificates, to allow you to set the keyId on the certificate beforehand.

- e936068: The `Key` and `Jwk` classes have been removed in favour of a new `PublicJwk` class, and all APIs in Credo have been updated to use the new `PublicJwk` class. Leveraging Jwk as the base for all APIs provides more flexility and makes it easier to support key types where it's not always so easy to extract the raw public key bytes. In addition all the previous Jwk relatedfunctionality has been replaced with the new KMS jwk functionalty. For example `JwaSignatureAlgorithm` is now `Kms.KnownJwaSignatureAlgorithms`.
- e936068: The wallet API has been completely rewritten to be more generic, support multiple backends at the same time, support generic encrypting and decryption, support symmetric keys, and enable backends that use key ids rather than the public key to identify a key. This has resulted in significant breaking changes, and all usages of the wallet api should be updated to use the new `agent.kms` APIs. In addition the wallet is not available anymore on the agentContext. If you used this, instead inject the KMS API using `agentContext.resolve(Kms.KeyManagementApi)`.
- 70c849d: update target for tsc compiler to ES2020. Generally this should not have an impact for the supported environments (Node.JS / React Native). However this will have to be tested in React Native
- 897c834: DIDComm has been extracted out of the Core. This means that now all DIDComm related modules (e.g. proofs, credentials) must be explicitly added when creating an `Agent` instance. Therefore, their API will be accesable under `agent.modules.[moduleAPI]` instead of `agent.[moduleAPI]`. Some `Agent` DIDComm-related properties and methods where also moved to the API of a new DIDComm module (e.g. `agent.registerInboundTransport` turned into `agent.didcomm.registerInboundTransport`).

  **Example of DIDComm Agent**

  Previously:

  ```ts
       const config = {
        label: name,
        endpoints: ['https://myendpoint'],
        walletConfig: {
          id: name,
          key: name,
        },
      } satisfies InitConfig

      const agent = new Agent({
        config,
        dependencies: agentDependencies,
        modules: {
          connections: new DidCommConnectionsModule({
             autoAcceptConnections: true,
          })
        })
      this.agent.registerInboundTransport(new DidCommHttpInboundTransport({ port }))
      this.agent.registerOutboundTransport(new HttpOutboundTransport())

  ```

  Now:

  ```ts
       const config = {
        label: name,
        walletConfig: {
          id: name,
          key: name,
        },
      } satisfies InitConfig

      const agent = new Agent({
        config,
        dependencies: agentDependencies,
        modules: {
          ...getDefaultDidcommModules({ endpoints: ['https://myendpoint'] }),
          connections: new DidCommConnectionsModule({
             autoAcceptConnections: true,
          })
        })
      agent.didcomm.registerInboundTransport(new DidCommHttpInboundTransport({ port }))
      agent.didcomm.registerOutboundTransport(new DidCommHttpOutboundTransport())
  ```

- bc6f0c7: Add support for ESM module syntax.

  - Use `tsdown` to bundle for ESM -> tsdown is based on rust, so it should help with performance
  - Update to `vitest` since jest doesn't work well with ESM -> this should also help with performance
  - Simplify type checking -> just a single type check script instead of one for all packages. This should help with performance.

  NOTE: Since React Native bundles your code, the update to ESM should not cause issues. In addition all latest minor releases of Node 20 and 22 now support requiring ESM modules. This means that even if you project is still a CommonJS project, it can now depend on ESM modules. For this reason Credo is now fully an ESM module.

  Initially we added support for both CJS and ESM in parallel. However this caused issues with some libraries requiring the CJS output, and other the ESM output. Since Credo is only meant to be installed a single time for the dependency injection to work correctly, this resulted in unexpected behavior.

### Patch Changes

- 13cd8cb: feat: support node 22
- 0c274fe: feat: support Ed25519 as an algorithm identifier for JWA
- Updated dependencies [55318b2]
- Updated dependencies [e936068]
- Updated dependencies [43148b4]
- Updated dependencies [2d10ec3]
- Updated dependencies [6d83136]
- Updated dependencies [312a7b2]
- Updated dependencies [1495177]
- Updated dependencies [1810764]
- Updated dependencies [2cace9c]
- Updated dependencies [879ed2c]
- Updated dependencies [297d209]
- Updated dependencies [2312bb8]
- Updated dependencies [11827cc]
- Updated dependencies [9f78a6e]
- Updated dependencies [297d209]
- Updated dependencies [652ade8]
- Updated dependencies [0500765]
- Updated dependencies [2cace9c]
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
- Updated dependencies [b5fc7a6]
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
- Updated dependencies [e936068]
- Updated dependencies [290ff19]
- Updated dependencies [8baa7d7]
- Updated dependencies [decbcac]
- Updated dependencies [9df09fa]
- Updated dependencies [2cace9c]
- Updated dependencies [70c849d]
- Updated dependencies [0c274fe]
- Updated dependencies [897c834]
- Updated dependencies [5ff7bba]
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
- Updated dependencies [11545ce]
- Updated dependencies [645363d]
- Updated dependencies [e80794b]
- Updated dependencies [9f78a6e]
- Updated dependencies [9f78a6e]
- Updated dependencies [8baa7d7]
- Updated dependencies [d06669c]
- Updated dependencies [decbcac]
- Updated dependencies [6c8ab94]
- Updated dependencies [bc6f0c7]
- Updated dependencies [676af7f]
- Updated dependencies [d9e04db]
- Updated dependencies [d6086e9]
- Updated dependencies [8be3d67]
- Updated dependencies [bd28bba]
- Updated dependencies [0d49804]
- Updated dependencies [27f971d]
  - @credo-ts/core@0.6.0
  - @credo-ts/didcomm@0.6.0

## 0.5.13

### Patch Changes

- Updated dependencies [595c3d6]
  - @credo-ts/core@0.5.13

## 0.5.12

### Patch Changes

- Updated dependencies [3c85565]
- Updated dependencies [3c85565]
- Updated dependencies [7d51fcb]
- Updated dependencies [9756a4a]
  - @credo-ts/core@0.5.12

## 0.5.11

### Patch Changes

- @credo-ts/core@0.5.11

## 0.5.10

### Patch Changes

- Updated dependencies [fa62b74]
  - @credo-ts/core@0.5.10

## 0.5.9

### Patch Changes

- @credo-ts/core@0.5.9

## 0.5.8

### Patch Changes

- Updated dependencies [3819eb2]
- Updated dependencies [15d0a54]
- Updated dependencies [a5235e7]
  - @credo-ts/core@0.5.8

## 0.5.7

### Patch Changes

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

**Note:** Version bump only for package @credo-ts/node

## [0.5.2](https://github.com/openwallet-foundation/credo-ts/compare/v0.5.1...v0.5.2) (2024-04-26)

### Bug Fixes

- node-ffi-napi compatibility ([#1821](https://github.com/openwallet-foundation/credo-ts/issues/1821)) ([81d351b](https://github.com/openwallet-foundation/credo-ts/commit/81d351bc9d4d508ebfac9e7f2b2f10276ab1404a))

## [0.5.1](https://github.com/openwallet-foundation/credo-ts/compare/v0.5.0...v0.5.1) (2024-03-28)

### Bug Fixes

- import of websocket ([#1804](https://github.com/openwallet-foundation/credo-ts/issues/1804)) ([48b31ae](https://github.com/openwallet-foundation/credo-ts/commit/48b31ae9229cd188defb0ed3b4e64b0346013f3d))

# [0.5.0](https://github.com/openwallet-foundation/credo-ts/compare/v0.4.2...v0.5.0) (2024-03-13)

**Note:** Version bump only for package @credo-ts/node

## [0.4.2](https://github.com/hyperledger/aries-framework-javascript/compare/v0.4.1...v0.4.2) (2023-10-05)

### Bug Fixes

- log and throw on WebSocket sending errors ([#1573](https://github.com/hyperledger/aries-framework-javascript/issues/1573)) ([11050af](https://github.com/hyperledger/aries-framework-javascript/commit/11050afc7965adfa9b00107ba34abfbe3afaf874))

## [0.4.1](https://github.com/hyperledger/aries-framework-javascript/compare/v0.4.0...v0.4.1) (2023-08-28)

### Bug Fixes

- **samples:** mediator wallet and http transport ([#1508](https://github.com/hyperledger/aries-framework-javascript/issues/1508)) ([04a8058](https://github.com/hyperledger/aries-framework-javascript/commit/04a80589b19725fb493e51e52a7345915b2c7341))

# [0.4.0](https://github.com/hyperledger/aries-framework-javascript/compare/v0.3.3...v0.4.0) (2023-06-03)

### Bug Fixes

- return HTTP 415 if unsupported content type ([#1313](https://github.com/hyperledger/aries-framework-javascript/issues/1313)) ([122cdde](https://github.com/hyperledger/aries-framework-javascript/commit/122cdde6982174a8e9cf70ef26a1393cb3912066))

- feat!: add data, cache and temp dirs to FileSystem (#1306) ([ff5596d](https://github.com/hyperledger/aries-framework-javascript/commit/ff5596d0631e93746494c017797d0191b6bdb0b1)), closes [#1306](https://github.com/hyperledger/aries-framework-javascript/issues/1306)

### Features

- add initial askar package ([#1211](https://github.com/hyperledger/aries-framework-javascript/issues/1211)) ([f18d189](https://github.com/hyperledger/aries-framework-javascript/commit/f18d1890546f7d66571fe80f2f3fc1fead1cd4c3))
- **anoncreds:** legacy indy proof format service ([#1283](https://github.com/hyperledger/aries-framework-javascript/issues/1283)) ([c72fd74](https://github.com/hyperledger/aries-framework-javascript/commit/c72fd7416f2c1bc0497a84036e16adfa80585e49))
- **askar:** import/export wallet support for SQLite ([#1377](https://github.com/hyperledger/aries-framework-javascript/issues/1377)) ([19cefa5](https://github.com/hyperledger/aries-framework-javascript/commit/19cefa54596a4e4848bdbe89306a884a5ce2e991))

### BREAKING CHANGES

- Agent-produced files will now be divided in different system paths depending on their nature: data, temp and cache. Previously, they were located at a single location, defaulting to a temporary directory.

If you specified a custom path in `FileSystem` object constructor, you now must provide an object containing `baseDataPath`, `baseTempPath` and `baseCachePath`. They can point to the same path, although it's recommended to specify different path to avoid future file clashes.

## [0.3.3](https://github.com/hyperledger/aries-framework-javascript/compare/v0.3.2...v0.3.3) (2023-01-18)

### Bug Fixes

- fix typing issues with typescript 4.9 ([#1214](https://github.com/hyperledger/aries-framework-javascript/issues/1214)) ([087980f](https://github.com/hyperledger/aries-framework-javascript/commit/087980f1adf3ee0bc434ca9782243a62c6124444))

## [0.3.2](https://github.com/hyperledger/aries-framework-javascript/compare/v0.3.1...v0.3.2) (2023-01-04)

**Note:** Version bump only for package @credo-ts/node

## [0.3.1](https://github.com/hyperledger/aries-framework-javascript/compare/v0.3.0...v0.3.1) (2022-12-27)

**Note:** Version bump only for package @credo-ts/node

# [0.3.0](https://github.com/hyperledger/aries-framework-javascript/compare/v0.2.5...v0.3.0) (2022-12-22)

- refactor!: add agent context (#920) ([b47cfcb](https://github.com/hyperledger/aries-framework-javascript/commit/b47cfcba1450cd1d6839bf8192d977bfe33f1bb0)), closes [#920](https://github.com/hyperledger/aries-framework-javascript/issues/920)

### Features

- add agent context provider ([#921](https://github.com/hyperledger/aries-framework-javascript/issues/921)) ([a1b1e5a](https://github.com/hyperledger/aries-framework-javascript/commit/a1b1e5a22fd4ab9ef593b5cd7b3c710afcab3142))
- specify httpinboundtransport path ([#1115](https://github.com/hyperledger/aries-framework-javascript/issues/1115)) ([03cdf39](https://github.com/hyperledger/aries-framework-javascript/commit/03cdf397b61253d2eb20694049baf74843b7ed92))

### BREAKING CHANGES

- To make AFJ multi-tenancy ready, all services and repositories have been made stateless. A new `AgentContext` is introduced that holds the current context, which is passed to each method call. The public API hasn't been affected, but due to the large impact of this change it is marked as breaking.

## [0.2.5](https://github.com/hyperledger/aries-framework-javascript/compare/v0.2.4...v0.2.5) (2022-10-13)

**Note:** Version bump only for package @credo-ts/node

## [0.2.4](https://github.com/hyperledger/aries-framework-javascript/compare/v0.2.3...v0.2.4) (2022-09-10)

**Note:** Version bump only for package @credo-ts/node

## [0.2.3](https://github.com/hyperledger/aries-framework-javascript/compare/v0.2.2...v0.2.3) (2022-08-30)

**Note:** Version bump only for package @credo-ts/node

## [0.2.2](https://github.com/hyperledger/aries-framework-javascript/compare/v0.2.1...v0.2.2) (2022-07-15)

**Note:** Version bump only for package @credo-ts/node

## [0.2.1](https://github.com/hyperledger/aries-framework-javascript/compare/v0.2.0...v0.2.1) (2022-07-08)

### Features

- initial plugin api ([#907](https://github.com/hyperledger/aries-framework-javascript/issues/907)) ([6d88aa4](https://github.com/hyperledger/aries-framework-javascript/commit/6d88aa4537ab2a9494ffea8cdfb4723cf915f291))

# [0.2.0](https://github.com/hyperledger/aries-framework-javascript/compare/v0.1.0...v0.2.0) (2022-06-24)

### Bug Fixes

- close session early if no return route ([#715](https://github.com/hyperledger/aries-framework-javascript/issues/715)) ([2e65408](https://github.com/hyperledger/aries-framework-javascript/commit/2e6540806f2d67bef16004f6e8398c5bf7a05bcf))
- **node:** allow to import node package without postgres ([#757](https://github.com/hyperledger/aries-framework-javascript/issues/757)) ([59e1058](https://github.com/hyperledger/aries-framework-javascript/commit/59e10589acee987fb46f9cbaa3583ba8dcd70b87))
- **node:** only send 500 if no headers sent yet ([#857](https://github.com/hyperledger/aries-framework-javascript/issues/857)) ([4be8f82](https://github.com/hyperledger/aries-framework-javascript/commit/4be8f82c214f99538eaa0fd0aac5a8f7a6e1dd6b))

### Features

- **core:** add support for postgres wallet type ([#699](https://github.com/hyperledger/aries-framework-javascript/issues/699)) ([83ff0f3](https://github.com/hyperledger/aries-framework-javascript/commit/83ff0f36401cbf6e95c0a1ceb9fa921a82dc6830))
- indy revocation (prover & verifier) ([#592](https://github.com/hyperledger/aries-framework-javascript/issues/592)) ([fb19ff5](https://github.com/hyperledger/aries-framework-javascript/commit/fb19ff555b7c10c9409450dcd7d385b1eddf41ac))

# 0.1.0 (2021-12-23)

### Bug Fixes

- **node:** node v12 support for is-indy-installed ([#542](https://github.com/hyperledger/aries-framework-javascript/issues/542)) ([17e9157](https://github.com/hyperledger/aries-framework-javascript/commit/17e9157479d6bba90c2a94bce64697d7f65fac96))

### Features

- add multiple inbound transports ([#433](https://github.com/hyperledger/aries-framework-javascript/issues/433)) ([56cb9f2](https://github.com/hyperledger/aries-framework-javascript/commit/56cb9f2202deb83b3c133905f21651bfefcb63f7))
- break out indy wallet, better indy handling ([#396](https://github.com/hyperledger/aries-framework-javascript/issues/396)) ([9f1a4a7](https://github.com/hyperledger/aries-framework-javascript/commit/9f1a4a754a61573ce3fee78d52615363c7e25d58))
- **core:** connection-less issuance and verification ([#359](https://github.com/hyperledger/aries-framework-javascript/issues/359)) ([fb46ade](https://github.com/hyperledger/aries-framework-javascript/commit/fb46ade4bc2dd4f3b63d4194bb170d2f329562b7))
- **core:** support multiple indy ledgers ([#474](https://github.com/hyperledger/aries-framework-javascript/issues/474)) ([47149bc](https://github.com/hyperledger/aries-framework-javascript/commit/47149bc5742456f4f0b75e0944ce276972e645b8))
- **node:** add http and ws inbound transport ([#392](https://github.com/hyperledger/aries-framework-javascript/issues/392)) ([34a6ff2](https://github.com/hyperledger/aries-framework-javascript/commit/34a6ff2699197b9d525422a0a405e241582a476c))
- **node:** add is-indy-installed command ([#510](https://github.com/hyperledger/aries-framework-javascript/issues/510)) ([e50b821](https://github.com/hyperledger/aries-framework-javascript/commit/e50b821343970d299a4cacdcba3a051893524ed6))
