# @credo-ts/didcomm

## 0.8.0

### Minor Changes

- b77a2c3: Remove support for the legacy `did:sov:BzCbsNYhMrjHiqZDTUASHg;spec` message type prefix (Aries RFC 0348). The agent only accepts and sends message types with the `https://didcomm.org` prefix.
  
  - The `useDidSovPrefixWhereAllowed` option is removed from the DIDComm module config. The `allowDidSovPrefix` property is removed from `DidCommMessage`, and `toJSON` does not take options anymore.
  - The `replaceLegacyDidSovPrefix` function is removed. The `supportsIncomingMessageType` and `supportsIncomingDidCommProtocolUri` functions do not take the `allowLegacyDidSovPrefixMismatch` option anymore.
  - Incoming messages, out of band invitations, credential previews and signature decorators with the legacy prefix are rejected.
  - Stored out of band records that contain an invitation with the legacy prefix are still read. The record converts the prefix when it is loaded.
  
  Credo / AFJ 0.1.0 and later and ACA-Py 0.11.0 and later send the `https://didcomm.org` prefix by default. ACA-Py 0.5.5 to 0.10.x need the `--emit-new-didcomm-prefix` flag. Agents configured with `useLegacyDidSovPrefix` or `useDidSovPrefixWhereAllowed` set to `true` must turn it off.
- dbde0f1: Remove the deprecated DIDComm v1 protocols: Connection (RFC 0160), Issue Credential v1 (RFC 0036) and Present Proof v1 (RFC 0037).
  
  `@credo-ts/didcomm`:
  
  - The agent does not register or advertise the `https://didcomm.org/connections/1.0` protocol anymore. Use the DID Exchange protocol (`DidCommHandshakeProtocol.DidExchange`) to create connections.
  - The `DidCommConnectionInvitationMessage`, `DidCommConnectionRequestMessage`, `DidCommConnectionResponseMessage` and `DidCommConnectionProblemReportMessage` classes, their handlers, the `DidCommConnectionRole` and `DidCommConnectionState` enums, `DidCommHandshakeProtocol.Connections` and `DidCommInvitationType.Connection` are removed.
  - The `createLegacyInvitation` method is removed from the out of band API. `receiveInvitation` only accepts a `DidCommOutOfBandInvitation`. The agent does not parse invitation URLs with a `c_i` query parameter anymore. Legacy connectionless invitations (`d_m` query parameter) are still supported.
  - The `imageUrl` option is removed from the receive and accept invitation methods of the out of band API. Only the connection protocol used this value.
  - The `rfc0160State` getter is removed from `DidCommConnectionRecord`.
  - The `DidCommConnectionService` does not contain the `createRequest`, `processRequest`, `createResponse`, `processResponse`, `processAck` and `processProblemReport` methods anymore.
  - The storage migration from version 0.1 to 0.2 still migrates connection records that were created with the connection protocol.
  
  `@credo-ts/anoncreds`:
  
  - The `DidCommCredentialV1Protocol` and `DidCommProofV1Protocol` classes and their messages are removed from `@credo-ts/anoncreds/didcomm`. Use `DidCommCredentialV2Protocol` and `DidCommProofV2Protocol` from `@credo-ts/didcomm` instead. The `LegacyIndyDidCommCredentialFormatService` and `LegacyIndyDidCommProofFormatService` can still be used with the v2 protocols.
- 526a989: Drop support for Node.js 20, which reached end-of-life. The minimum supported Node.js version is now 22.
- 4dd128a: Emit `DidCommMessageProcessingFailed` when an inbound message received through the DIDComm event path cannot be processed.
  
  ```ts
  agent.events.on<DidCommMessageProcessingFailedEvent>(
    DidCommEventTypes.DidCommMessageProcessingFailed,
    ({ payload }) => {
      // payload.error, payload.message, payload.connection, payload.contextCorrelationId, payload.receivedAt
    }
  )
  ```
- 3678fb3: Remove support for unqualified (legacy) AnonCreds identifiers. All AnonCreds identifiers must be fully qualified. Use `did:indy` identifiers for objects on an indy ledger.
  
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
- b1090de: Remove duplicate error-level logging at throw sites that already chain the original error as `cause`.
- 78d5cfb: Log key fingerprints instead of full `PublicJwk` objects.
- 194cf1e: Make published TypeScript declarations resolvable without development dependencies. Move `@types/events` to dependencies in `@credo-ts/core`, and `@types/node` and `@types/ws` to dependencies in `@credo-ts/node`. Replace non-portable and self-referential imports in core, and use `AgentDependencies` for the WebSocket type in `@credo-ts/didcomm` instead of importing from undeclared `ws`.

### Patch Changes

- c2bb4d5: Validate JSON-LD credential signing readiness before accepting a proposal or creating a direct or negotiated offer. The preflight checks that the issuer verification method belongs to a DID created by the agent and is compatible with the requested proof type. This requires a created DID record and a resolvable issuer DID document earlier in the exchange, at offer creation or proposal acceptance, rather than waiting until request acceptance. For example, a `did:web` issuer is now resolved at offer time. Capability failures use the typed `W3cJsonLdCredentialSigningNotSupportedError`, allowing callers to choose a negotiation or rejection flow. Signing-time checks also use this error for the same capability failures. When a created DID or verification method cannot be found, the typed error wraps the original error as its cause.
- 0b9531a: Added Aries RFC 881 (vc+sd-jwt) format handler
  
  `@credo-ts/core` now exports `validateW3cV2SdJwtDisclosureFrame` and `NON_DISCLOSEABLE_FIELDS`, so that
  a disclosure frame can be validated before it is used to sign a credential.
  
  The `didcomm_signed_attachment` binding method is now implemented by a helper shared with the data
  integrity format. As a result the data integrity format also accepts a binding proof whose attachment
  payload is base64url encoded, in addition to base64. Signed attachments are still produced as base64,
  so this only widens what is accepted from other agents.
- 218237d: - `connections.deleteById` now removes the mediator routing of a connection that was hung up before. The hangup clears the `did` of the record, so the routing of its last did was never removed. `hangup({ deleteAfterHangup: true })` relies on this and no longer removes the routing itself.
  - `DidCommDocumentService.resolveCreatedDidDocumentWithKeysByRecipientKey` no longer fails when the Ed25519 recipient key of an inbound message is not a valid Ed25519 point (for example X25519 bytes in a legacy `~service` decorator). The lookup continues with the out-of-band and mediator records instead.
  - `DidCommConnectionService.returnWhenIsConnected` rejects an empty `connectionId` with a clear `CredoError` before it subscribes to connection events, instead of a `RecordNotFoundError` from the record lookup with a subscription that stays open until the timeout.
- fac9757: Invitation URLs whose `oob`, `c_i` or `d_m` parameter is encoded as padded base64url or standard base64 are now accepted, instead of failing with `Could not decode data from base64url string`. The encoded value is decoded as base64url first (with padding stripped) and falls back to standard base64, matching how signed attachment data is decoded since #2761.
- 95b0dd5: The `DidCommMessageProcessed` event payload now includes `handled`, which is `false` when no message handler ran, for example because a middleware dropped the message without calling `next`.
- 81265f5: Fixed lost did services when cloning an out-of-band record. If the record was loaded from storage or the invitation was received, a clone had an empty string for every did service of the invitation. The records in record events and out-of-band state changed events are clones, so listeners got invitations without their did services. Stored records were not affected.
- 3d4b386: fix: only close a transport session for the message that opened it. Previously a later message without return routing (e.g. the trust ping sent while connecting to a mediator) could close a WebSocket session that was still needed to return a response, causing intermittent mediation timeouts.
  
  `DidCommWsOutboundTransport` now also replaces sockets that are no longer open, instead of reusing them.
- b51f8b5: The messages and handlers of the Routing 1.0 and Basic Message 1.0 protocols moved to `modules/routing/protocol/v1` and `modules/basic-messages/protocol/v1`, the layout that the credentials, proofs, discover-features and message-pickup modules already use. The exports of `@credo-ts/didcomm` are unchanged. A deep import of a moved file (for example `@credo-ts/didcomm/build/modules/routing/messages`) must point at the new path.
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
- 82a6efd: Export the discover features, mediator and mediation recipient module config classes and options types, consistent with the other DIDComm modules.
- da2a293: `DidCommHttpOutboundTransport` clears its 15 second request timeout when the request fails, so a failed request no longer keeps the process alive.
- dde35e0: Fixed concurrent keylist updates to the same mediator resolving each other. `keylistUpdateAndAwait` now waits for the `KeylistUpdateResponse` threaded to its own `KeylistUpdate`, so when several connections are created at once (for example through a multi-use invitation) none of them continues before the mediator has registered its key. Unthreaded responses are still accepted.
  
  The `DidCommRecipientKeylistUpdated` event payload now includes the `threadId` of the response.
- 82a6efd: Update the TypeScript development dependency to TypeScript 7 (`typescript@^7.0.2`, installed as `@typescript/native`) for type checking. The `typescript` package is now an alias of `@typescript/typescript6@^6.0.2`, so tools that use the TypeScript compiler API, such as `tsdown` when generating declaration files, keep working.
  
  This has no effect on runtime behaviour. `getPublicJwkFromDid` in `@credo-ts/openid4vc` now declares its `Promise<PublicJwk>` return type, which is the type it already returned.
- e851280: The mediator reconnect loop no longer gives up when live mode setup fails after a reconnect. It closes the mediator socket with the new optional `closeSocketByConnectionId` outbound transport method and tries again with a jittered backoff that resets once a setup succeeds. This also applies when the queued messages cannot be fully retrieved within the pickup timeout: the socket is closed and the next attempt continues with the remaining messages. `pickupMessages` with `awaitCompletion` now only completes on its own thread (its follow-up pickup messages carry `~thread`), so it will time out against a mediator that does not thread its `status` or `batch` replies. `setLiveDeliveryMode` has an opt-in `awaitConfirmation`, and mediators only report `live_delivery` as true for the socket that holds the live session.
- 3c27483: With `QueueAndLiveModeDelivery`, a failed live delivery no longer fails the forward, because the message is already queued. When sending the delivery fails, the mediator ends that live mode session and closes its transport, so the recipient reconnects and picks the message up. `InMemoryQueueTransportRepository` now puts the messages it handed out for a connection back in the queue when that connection's live mode session ends, so the next pickup delivers them. `deliverMessagesFromQueue` no longer takes messages for a live mode session that ended while it loaded the connection. `DidCommQueueTransportRepository` has an optional `start` hook that `DidCommModule` calls on initialize.
- cf46149: `Repository.updateByIdWithLock` now stores the record returned by the callback when the storage service has no lock, instead of the record it read. When two mediator instances create the routing record at the same time, the instance that loses now deletes the routing keys it created instead of leaving them in the KMS.
- aadabc9: Add `supportedJwaSignatureAlgorithms` to the `KeyManagementApi`, which excludes symmetric (HMAC) algorithms unless `includeSymmetricAlgorithms` is set. OpenID4VC and DIDComm now use it, so symmetric algorithms are no longer advertised in metadata such as `vp_formats_supported`, `proof_signing_alg_values_supported` and `algsSupported`.
- 526a989: feat: support node 26
- 25199e8: `proofs.requestProof()` and `proofs.createRequest()` accept an optional `expiresTime`. When set, the request message carries the RFC 0032 `~timing.expires_time` decorator for present proof v2. It is set before the request is stored, so `findRequestMessage()` returns it too. The decorator is advisory: Credo does not act on it when receiving a request.
  
  ```ts
  await agent.didcomm.proofs.requestProof({
    connectionId,
    protocolVersion: 'v2',
    proofFormats: { presentationExchange: { presentationDefinition } },
    expiresTime: new Date(Date.now() + 30 * 60 * 1000),
  })
  ```
- 2f20e2e: Fix the 15 second timeout when resolving a shortened invitation URL. The abort signal was never passed to `fetch`, so a server that accepted the connection but never responded left `parseInvitation` pending indefinitely.
- 7ba15bc: Fix JSON-LD credential exchanges failing or silently stalling when the issuer's signature suite adds its own `@context` to the credential.
  
  A signature suite must add its `@context` to the document it signs when the document does not already carry a compatible one. The holder compared the received credential to the credential request for exact equality, so this required addition was treated as a mismatch. In practice this affected `Ed25519Signature2020`, whose terms are not defined by the `credentials/v1` context, and it was not limited to a hard failure: the same check backs `shouldAutoRespondToCredential`, so with `AutoAcceptCredential.ContentApproved` the exchange stalled without an error.
  
  The holder now also accepts the requested credential with the agreed proof type's suite context appended. Any other difference is still rejected.
- 64fec67: The data integrity credential format now verifies a received VC Data Model 1.1 credential that has no AnonCreds link secret binding before storing it, including the issuer trust check. Before, only VC Data Model 2.0 credentials were verified.
- 81265f5: All records in Credo are now encoded, decoded and validated with a zod schema instead of class-transformer and class-validator. This is the first step of moving Credo away from class-transformer and class-validator. The stored format of records doesn't change, so no storage migration is needed.
  
  A class opts in by defining a static `encodingSchema` (a zod codec). `JsonTransformer` and `MessageValidator` use it when present, and fall back to class-transformer and class-validator otherwise, so custom records and other classes keep working without changes. Records can define their schema with `createRecordEncodingSchema`:
  
  ```ts
  import { BaseRecord, createRecordEncodingSchema, zIsoDate } from '@credo-ts/core'
  import { z } from 'zod'
  
  const myRecordEncodingSchema = createRecordEncodingSchema({
    name: z.string(),
    expiresAt: zIsoDate.optional(),
  })
  
  export class MyRecord extends BaseRecord {
    public static get encodingSchema() {
      return myRecordEncodingSchema
    }
  
    // ...
  }
  ```
  
  Some things behave differently:
  
  - A stored record that fails to decode now throws a `RecordDecodingError` with the `recordType` and `recordId`, caused by a `ZodValidationError`. Before, this was a `ClassValidationError`. `ZodValidationError` and `ClassValidationError` now both extend `CredoValidationError`.
  - Drizzle storage encodes a record before it stores it, so an invalid record is never stored. Askar already did.
  - A subclass of a Credo record inherits the record's `encodingSchema`. Properties the subclass adds with class-transformer decorators are still stored, but no longer transformed (for example a `Date` is decoded as a string). Define an `encodingSchema` on the subclass to transform them.
- Updated dependencies [c2bb4d5]
- Updated dependencies [0b9531a]
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
- Updated dependencies [9eadcb8]
- Updated dependencies [1ee57f6]
- Updated dependencies [14e84ce]
- Updated dependencies [3985e5b]
- Updated dependencies [77fe670]
- Updated dependencies [526a989]
- Updated dependencies [5cb5e46]
- Updated dependencies [b2ac66a]
- Updated dependencies [4c2f93b]
- Updated dependencies [1de1ead]
- Updated dependencies [fb968ea]
- Updated dependencies [fb968ea]
- Updated dependencies [fb968ea]
- Updated dependencies [716cb84]
- Updated dependencies [82a6efd]
- Updated dependencies [667c462]
- Updated dependencies [87e9c1a]
- Updated dependencies [87e9c1a]
- Updated dependencies [1bbcdc3]
- Updated dependencies [cf46149]
- Updated dependencies [56516ee]
- Updated dependencies [4fed115]
- Updated dependencies [aadabc9]
- Updated dependencies [ae0fe8e]
- Updated dependencies [ee69f9d]
- Updated dependencies [357a5da]
- Updated dependencies [0814729]
- Updated dependencies [2e13dd1]
- Updated dependencies [fb99743]
- Updated dependencies [526a989]
- Updated dependencies [b21bba5]
- Updated dependencies [0b7ba8d]
- Updated dependencies [8a6af0b]
- Updated dependencies [8178149]
- Updated dependencies [7ba15bc]
- Updated dependencies [194cf1e]
- Updated dependencies [ac3b95b]
- Updated dependencies [ae0fe8e]
- Updated dependencies [1ee57f6]
- Updated dependencies [faaf1e0]
- Updated dependencies [56ae9a6]
- Updated dependencies [93907de]
- Updated dependencies [94faeed]
- Updated dependencies [dbbef02]
- Updated dependencies [faaf1e0]
- Updated dependencies [dbafd1e]
- Updated dependencies [2151443]
- Updated dependencies [c05145a]
- Updated dependencies [808e873]
- Updated dependencies [81265f5]
  - @credo-ts/core@0.8.0

## 0.7.1

### Patch Changes

- 9f4278b: Add `DidDocument.findVerificationMethodsByPurpose` and
  `DidDocument.findVerificationMethodsByTypeAndPurpose`.
  
  The relationship-aware methods resolve inline and referenced methods and
  return them in requested relationship order while preserving entry order
  within each relationship. The type-filtered method accepts one or more
  verification-method representations and delegates relationship traversal to
  the purpose-only method. DIDComm JSON-LD, JWT credentials, presentation
  selection, DIDComm messaging, AnonCreds data integrity, Cheqd signing, peer
  DID conversion, and did:webvh signing now use the appropriate shared lookup.
  AnonCreds credential signing prefers verification methods authorized for
  `assertionMethod`, with declared `verificationMethod` entries as a fallback.
- b75467c: Move the W3C Data Integrity credential attachment format (Aries RFC 0809) out of `@credo-ts/anoncreds` and into `@credo-ts/didcomm`, where the rest of the format already lived. The format is not anoncreds specific: binding a credential to an anoncreds link secret is one of its binding methods, next to the didcomm signed attachment method and to not binding the credential at all. Issuing a plain W3C credential over this format no longer requires depending on `@credo-ts/anoncreds`.
  
  - Added `DidCommDataIntegrityCredentialFormatService` to `@credo-ts/didcomm`. `DataIntegrityDidCommCredentialFormatService` in `@credo-ts/anoncreds` is now a deprecated alias for it and will be removed in the next major version.
  - Added the `DidCommDataIntegrityLinkSecretBindingProvider` interface and its injection token, implementing the `anoncreds_link_secret` binding method. `@credo-ts/anoncreds` provides `AnonCredsLinkSecretBindingProvider` and the `AnonCredsModule` registers it, so agents using anoncreds keep the binding method with no changes. Using the binding method without the `AnonCredsModule` registered now fails with an explanatory error rather than an unresolved dependency.
  - Fixed `deleteCredentialById` deleting every credential of this format through the anoncreds holder service. Credentials that were not bound to a link secret are now removed as the plain `W3cCredentialRecord` or `W3cV2CredentialRecord` they are stored as.
- cfe86fa: X509 trusted certificates now can be provided in a new format. Previously it was a list of base64/pem/der encoded certificates, but now you can _also_ provide a list of objects in the format `[{issuance: string[], status? :string[]}]`. This is used for the new status indicator on mdoc. First, it looks for the used `issuance` trusted certificates and then validates the `status`, if available, with the `status` trusted certificates associated with the `issuance` property.
- b75467c: Support issuing Verifiable Credentials Data Model 2.0 credentials over the W3C Data Integrity credential attachment format (Aries RFC 0809). The format previously advertised `data_model_versions_supported: ['1.1']` and rejected a data model 2.0 credential, even though the agent was already able to secure one with a `DataIntegrityProof`.
  
  The data model version is negotiated on the wire as the RFC describes: the offer advertises the version of the credential it carries, and the holder echoes its choice as `data_model_version` on the request. Which cryptosuite secures the credential is not negotiated, as RFC 0809 leaves that choice to the issuer.
  
  - The base JSON-LD context of the offered credential now determines the advertised `data_model_versions_supported`, so offering a credential in the `https://www.w3.org/ns/credentials/v2` context works without further configuration. Offers for data model 1.1 credentials are unaffected.
  - Added the `cryptosuite` data integrity credential format option, naming the Data Integrity cryptosuite used to secure a data model 2.0 credential, for example `eddsa-jcs-2022`. When omitted, the first registered cryptosuite supporting the key type of the issuer verification method is used. It is ignored for data model 1.1, which is secured with a linked data signature suite instead. The `anoncreds-2023` cryptosuite is rejected, as it is only produced through the anoncreds link secret binding method.
  - `W3cDataIntegrityApi.getSupportedCryptosuites` accepts an optional public JWK type, returning only the cryptosuites that support that key type.
  - A received data model 2.0 credential is verified and stored as a `W3cV2CredentialRecord`. Deleting a credential of this format looks the record up in both the data model 1.1 and 2.0 stores, so the record type on the credential exchange record stays `'w3c'` for both versions.
  - The anoncreds link secret binding method is rejected for data model 2.0 credentials, both when creating an offer and when issuing, as that binding method is defined for data model 1.1 and the `anoncredsvc-2023` cryptosuite only.
  - Fixed the comparison of the offered and the received credential subject, which rejected any claim with a falsy value: a credential carrying a claim such as `0`, `false` or `''` was refused by the holder as not matching the offer. Claims are now compared by presence.
- cfe86fa: TokenStatusList is a new standard module on the agent. It allows you to create/update/fetch token status lists. It is up to the user to host this, this can be easily done with the `statusList` you receive from the `agent.tokenStatusList.createTokenStatusList(...)` function. Updating the statuslist allows you to change the status list credential state from valid to invalid, but also update the expiry time, rotate certificates, change signing algorithm, etc. Signatures are the default and mac should only be used if the user is aware of the security implications and has good reason to do so.
- Updated dependencies [9f4278b]
- Updated dependencies [f127ff5]
- Updated dependencies [5cfcadb]
- Updated dependencies [84dfcf4]
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

- 10a3ce5: fix: do not include kid in signed attachment JWK
- Updated dependencies [5056b97]
- Updated dependencies [b75f0bf]
- Updated dependencies [120cee8]
- Updated dependencies [c1ab9be]
- Updated dependencies [10a3ce5]
- Updated dependencies [cc65c27]
- Updated dependencies [b7aec4e]
  - @credo-ts/core@0.7.0

## 0.6.3

### Patch Changes

- Updated dependencies [73d2d59]
  - @credo-ts/core@0.6.3

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

## 0.6.1

### Patch Changes

- 251cbe5: fix: allow sending Problem Report when a DIDComm proofs flow is in proposal-sent state
- Updated dependencies [9f60e1b]
  - @credo-ts/core@0.6.1

## 0.6.0

### Minor Changes

- 879ed2c: deprecate node 18
- 2cace9c: refactor: remove support for DIDComm linked attachments. The functionality was not working correctly anymore, and only supported for the deprecated v1 issuance protocol
- b5fc7a6: - All `didcomm` package modules, APIs, models and services that are used for dependency injection now are prefixed with `DidComm` in its naming
  - DIDComm-related events have also changed their text string to make it possible to distinguish them from events triggered by other protocols
  - DIDComm credentials module API has been updated to use the term `credentialExchangeRecord` instead of `credentialRecord`, since it is usually confused with W3cCredentialRecords (and potentially other kind of credential records we might have). I took this opportunity to also update `declineOffer` options structure to match DIDComm proofs module API
  - DIDComm-related records were renamed, but their type is still the original one (e.g. `CredentialRecord`, `BasicMessageRecord`). Probably it's worth to take this major release to do the migration, but I'm afraid that it will be a bit risky, so I'm hesitating to do so or leaving it for some other major upgrade (if we think it's actually needed)
- e936068: when signing in Credo, it is now required to always reference a key id. For DIDs this is extracted from the DidRecord, and for JWKs (e.g. in holder binding) this is extracted form the `kid` of the JWK. For X509 certificates you need to make sure there is a key id attached to the certificate manually for now, since we don't have a X509 record like we have a DidRecord. For x509 certificates created before 0.6 you can use the legacy key id (`certificate.keyId = certificate.publicJwk.legacyKeyId`), for certificates created after 0.6 you need to manually store the key id and set it on the certificate after decoding.

  For this reason, we now require instances of X509 certificates where we used to require encoded certificates, to allow you to set the keyId on the certificate beforehand.

- 2cace9c: The following modules are marked as deprecated and will be removed in version 0.7 of Credo:
  - DIDComm Connection Protocol V1 - Update to the DID Exchange protocol instead.
  - DIDComm V1 Credential Protocol - Update to the DIDComm V2 Credential Protocol instead.
  - DIDComm Legacy Indy Credential Format - Update to the DIDComm AnonCreds Credential Format.
  - DIDComm V1 Proof Protocol - Update to the DIDComm V2 Proof Protocol instead.
  - DIDComm Legacy Indy Proof Format - Update to the DIDComm AnonCreds Proof Format.
- 0d877f5: Now using did:peer:4 by default when creating DID Exchange Requests as response to an Out of Band invitation.

  It is possible to return to previous behaviour by manually setting `peerNumAlgoForDidExchangeRequests` option in DIDComm Connections module config.

- e936068: The `Key` and `Jwk` classes have been removed in favour of a new `PublicJwk` class, and all APIs in Credo have been updated to use the new `PublicJwk` class. Leveraging Jwk as the base for all APIs provides more flexility and makes it easier to support key types where it's not always so easy to extract the raw public key bytes. In addition all the previous Jwk relatedfunctionality has been replaced with the new KMS jwk functionalty. For example `JwaSignatureAlgorithm` is now `Kms.KnownJwaSignatureAlgorithms`.
- e936068: The wallet API has been completely rewritten to be more generic, support multiple backends at the same time, support generic encrypting and decryption, support symmetric keys, and enable backends that use key ids rather than the public key to identify a key. This has resulted in significant breaking changes, and all usages of the wallet api should be updated to use the new `agent.kms` APIs. In addition the wallet is not available anymore on the agentContext. If you used this, instead inject the KMS API using `agentContext.resolve(Kms.KeyManagementApi)`.
- 9df09fa: - messagehandler should return undefined if it doesn't want to response with a message
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

- 81e3571: BREAKING CHANGE:

  `label` and `connectionImageUrl` have been dropped from Agent configuration. Therefore, it must be specified manually in all DIDComm connection establishment related methods. If you don't want to specify any label, just use an empty value.

  In the particular case of mediation provisioning through a `mediatorInvitationUrl`, the label will be always set to an empty value ('').

- 9ef54ba: `MessagePickupRepository` has been refactored to `QueueTransportRepository`, and now belongs to DIDComm module configuration. As a result, MessagePickupRepository injection symbol has been dropped. If you want to retrieve current QueueTransportRepository instance, resolve DidCommModuleConfig and get `queueTransportRepository`.

  All methods in QueueTransportRepository now include `AgentContext` as their first argument.

- bc6f0c7: Add support for ESM module syntax.

  - Use `tsdown` to bundle for ESM -> tsdown is based on rust, so it should help with performance
  - Update to `vitest` since jest doesn't work well with ESM -> this should also help with performance
  - Simplify type checking -> just a single type check script instead of one for all packages. This should help with performance.

  NOTE: Since React Native bundles your code, the update to ESM should not cause issues. In addition all latest minor releases of Node 20 and 22 now support requiring ESM modules. This means that even if you project is still a CommonJS project, it can now depend on ESM modules. For this reason Credo is now fully an ESM module.

  Initially we added support for both CJS and ESM in parallel. However this caused issues with some libraries requiring the CJS output, and other the ESM output. Since Credo is only meant to be installed a single time for the dependency injection to work correctly, this resulted in unexpected behavior.

- d9e04db: Update to Express JS v5. If you're using the DIDComm Http transports, or the OpenID4VC issuer and verifier packages you should update to Express v5

### Patch Changes

- 1810764: fix: incorrect key alg for didcomm. With the introduction of the new KMS API, the XC20P algorithm was used instead of the C20P. This is not resolved and tests have been added to ensure interop with previous Credo versions.
- 652ade8: feat(didcomm): emit event on hangup
- 617b523: - Added a new package to use `redis` for caching in Node.js
  - Add a new option `allowCache` to a record, which allows to CRUD the cache before calling the storage service
    - This is only set to `true` on the `connectionRecord` and mediation records for now, improving the performance of the mediation flow
- 09ea6e3: fix: correctly find did record for recieved message if didcomm service uses X25519 key as recipientKey
- a4f443b: fix: allow did URLs in thread ids
- 5ff7bba: feat(didcomm): allow sending revocation notifications without the need of keeping the related Credential Exchange record
- 11545ce: - Made the receivedAt property of a queued DIDComm message required
- d06669c: feat: support DIDComm Out of Band proof proposals
- 676af7f: feat: allow setting DIDComm transports on Agent constructor by setting `transports` in DIDComm module configuration
- d6086e9: Export a few utils used by dependents.
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
