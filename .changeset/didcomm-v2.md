---
'@credo-ts/didcomm': patch
'@credo-ts/core': patch
'@credo-ts/node': patch
---

Add DIDComm v2 ([DIDComm Messaging v2.1](https://identity.foundation/didcomm-messaging/spec/v2.1/)) next to DIDComm v1. Support for v2 is opt-in: `didcommVersions` defaults to `['v1']`, and an agent without v2 rejects v2 envelopes and keeps its v1 behaviour. An agent with both versions talks v1 and v2 at the same time. The version of a connection is stored on the connection record, so existing v1 connections keep working and new connections use the version of the invitation they come from. The public API has no breaking changes: all v2 additions are new types, members, options or overloads next to the existing ones.

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
