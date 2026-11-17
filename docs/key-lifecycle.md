# Key lifecycle

This document lists the KMS keys Credo creates or uses, how long they live, how they rotate and who deletes them. Update it with every change that creates, stores, uses, rotates or deletes a key.

## Rules

- Keys Credo creates for a session (OID4VP and mdoc verification sessions, OpenID4VCI issuance sessions) are deleted with the session. Opt out with `deleteAssociatedKey: false`, or `deleteAssociatedDpopKey: false` for issuance sessions.
- Keys of credentials, connections, invitations and DIDs are deleted only when you ask, because you may have passed them in or another record may share them. The options are `deleteAssociatedKeys: true` on DIDs, credentials and DIDComm records, `deleteRemovedKeys` on a DID update, `deleteWithRecord` on DIDComm routing and deleting the previous keys of an issuer. None of them checks whether another record still uses a key.
- A key you created or passed in (a `keyId`, `routing`, `ourDid`, a binding resolver, configured keys) is only deleted by one of those options. The tables say when you have to delete it yourself.
- When creating a session key, a rotated issuer key or a DID fails before anything is published, Credo deletes the key again. DIDComm doesn't, see Known gaps.
- When `deleteAssociatedKeys` or deleting the previous keys of an issuer can't delete every key, it throws `KeyManagementKeysNotDeletedError` and keeps the record, or the keys it couldn't delete, so you can retry. A key that is already gone counts as deleted. `deleteRemovedKeys` logs a key it can't delete instead, because the DID update has already happened.

## Backends

- `agent.kms.createKey` and `createKeyForSignatureAlgorithm` use the `backend` you pass, or else the default backend, and return the backend that created the key.
- `agent.kms.deleteKey` deletes from the `backend` you pass, or else from the backend that holds the key. It returns `false` when no backend has the key.
- Records store a key as a `KmsKeyReference` (`keyId` and `kmsBackend`), and Credo deletes it from that backend. Keys stored before the backend was recorded are looked up in each backend.
- `TenantsApi.deleteTenantById` removes the tenant's keys only on Askar, which removes the tenant's profile or store. The Node backend (`NodeKeyManagementStorage`) and the secure environment backend have no per-tenant cleanup, so delete the tenant's keys before the tenant. Secure environment keys aren't scoped to a tenant at all.
- The secure environment backend only creates P-256 keys and only signs with ES256, so it can't hold the keys Credo creates for decryption (the OID4VP response key, the mdoc session key). Make another backend the default when you need them.

## Ephemeral keys

These keys live inside the KMS backend for one operation and are never stored. Nothing to delete.

| Use | Where |
|---|---|
| ECDH-ES, ECDH-1PU and HPKE ephemeral keys, wrapped content keys | `encrypt` in the Askar and Node backends |
| DIDComm v1 envelopes (content key, anoncrypt box) | `DidCommEnvelopeService` |
| DIDComm v2 envelopes (ECDH-ES+A256KW, ECDH-1PU+A256KW) | `DidCommV2EnvelopeService`. The authcrypt sender key is the DID's keyAgreement key, see DIDComm |
| JWE for an OID4VP response (holder) and an encrypted credential response (issuer) | `JweService` |
| mdoc DC API response (holder, HPKE seal) | `mdocContext` |

## OpenID4VC

| Key | Created by | Lifetime and rotation | Deleted |
|---|---|---|---|
| OID4VP response encryption key (verifier), P-256 | Credo, for every authorization request with `direct_post.jwt` or `dc_api.jwt` | Per verification session, stored as `responseEncryptionKey`. Older sessions lack that field: the key id is the `kid` of the `use: 'enc'` key in the request's `client_metadata.jwks`, or before Credo 0.6 the key's fingerprint, with the key stored under its legacy key id | With `verifier.deleteVerificationSessionById` unless `deleteAssociatedKey: false`, and when `createAuthorizationRequest` fails. Not on expiry, so delete expired sessions |
| Access token signing key (issuer), Ed25519 by default | Credo, in `createIssuer` and `rotateAccessTokenSigningKey`, or you with `accessTokenSigner` | Long-lived, stored as `accessTokenKey`. Rotation moves the current key to `previousAccessTokenKeys`, where it still verifies the tokens it signed | With `deletePreviousAccessTokenSigningKeys` (`deleteFromKms: false` only removes them from the issuer), and when storing a rotation fails. Issuers can't be deleted |
| Chained authorization server DPoP key, configured | You, as `dpop.keyId` in the issuer's `authorizationServerConfigs` | Long-lived, used by every issuance session of that authorization server. Changing it only affects new sessions | Never by Credo. Delete it once no open issuance session uses it |
| Chained authorization server DPoP key, generated | Credo, at the PAR request when no `dpop.keyId` is configured | Per issuance session, stored in `chainedIdentity.externalDpop` with `keyGeneratedForSession: true` | With `issuer.deleteIssuanceSessionById` unless `deleteAssociatedDpopKey: false`, and when saving the session fails at PAR |
| Credential request encryption keys (issuer) | You, in `credentialRequestEncryption.keys`, or Credo in `rotateCredentialRequestEncryptionKey` | Long-lived. Rotation advertises a new key (in the backend of the current key, or the `key` you pass) and moves the current keys to `previousKeys`, where they still decrypt requests but aren't advertised | With `deletePreviousCredentialRequestEncryptionKeys` (`deleteFromKms: false` only removes them from the issuer), and when storing a rotation fails. Keys you remove with `updateIssuerMetadata` aren't deleted |
| Credential response encryption key (holder), P-256 | Credo, when a credential or deferred credential request asks for an encrypted response | One request, not stored | By Credo when the request finishes or fails |
| Holder DPoP key | Credo, in the authorization or token request when you pass no `dpop` | One issuance flow, not stored. Returned as `dpop` and reused for the credential and notification requests | Never by Credo. Delete it after the last request of the flow |
| Wallet and client attestation keys | You | As long as the attestation is valid | Never by Credo. Delete it when you replace the attestation |
| Credential binding keys, SD-JWT VC and mdoc (holder) | You, through `credentialBindingResolver` | Per credential, stored as `credentialInstances[].kmsKeyId` and `kmsBackend`. Used instances stay on the record | With `sdJwtVc.deleteById` or `mdoc.deleteById` and `deleteAssociatedKeys: true`. For instances without `kmsKeyId`, Credo deletes the legacy key id of the holder key |

### Credential binding DIDs

A holder binds OpenID4VCI and DIDComm credentials to a DID through `credentialBindingResolver`, the `didCommSignedAttachment` `kid` or the `credentialSubject.id` of a JSON-LD credential. W3C credentials only bind to DIDs.

The DID is yours and lives on its own unless you set `deleteWithRecord: true` (`deleteDidWithRecord` in the JSON-LD format). The credential record then stores it in its `_internal/holderBindingDids` metadata, and the credential's `deleteById` (`sdJwtVc`, `mdoc`, `w3cCredentials`, `w3cV2Credentials`) with `deleteAssociatedKeys: true` deletes the DID record and its keys. Until the credential is stored, the DIDComm credential exchange record holds the DIDs. `credentials.deleteById` with `deleteAssociatedKeys: true` deletes the DIDs of the exchange's credentials, stored or not.

`deleteWithRecord` only works for DID methods without deactivation, such as did:key, did:jwk and did:peer. It throws for other DIDs.

## mdoc

| Key | Created by | Lifetime and rotation | Deleted |
|---|---|---|---|
| DC API session key (verifier), P-256 | Credo, in `createDcApiVerificationSession` | Per verification session, stored as `sessionKey` | With `mdoc.deleteVerificationSessionById` unless `deleteAssociatedKey: false`, and when creating the request fails. Not on expiry |

The holder's device key is a credential binding key, see OpenID4VC.

## DIDs

A DID record links its document to KMS keys in `keys[{ kmsKeyId, didDocumentRelativeKeyId }]`. The keys live as long as the DID.

`dids.deactivate({ did })` deactivates the DID and sets its record's status to `deactivated`, after which the DID can't be updated. It keeps the record and the keys. A did:cheqd or did:hedera that is already deactivated on the ledger only gets its record marked. A DID this agent didn't create can't be deactivated. Askar records stored before the status existed have no `status` tag, so query active DIDs with `$not: { status: 'deactivated' }`.

`dids.deleteCreatedDid({ did, deleteAssociatedKeys })` deletes the DID record, and with `deleteAssociatedKeys: true` its keys. It doesn't deactivate the DID, and throws for an active DID unless you pass `deleteActiveDid: true`:

- DID methods without deactivation (`deactivationSupport: 'notSupportedByMethod'`: did:key, did:jwk and did:peer) can always be deleted.
- did:indy and did:webvh, whose registrars don't implement deactivation, and methods without a registrar always need `deleteActiveDid: true`. Keep a did:webvh record as long as you publish its DID log, because the record holds the log.
- For a record without `keys`, Credo deletes the legacy key id of each verification method in the stored DID document, or else in the resolved one. When the DID doesn't resolve, it logs a warning and deletes only the record.

`dids.update({ did, didDocument, deleteRemovedKeys })` deletes the keys of the verification methods the update removed, unless a remaining verification method uses the same key. Only did:cheqd and did:hedera support it, because their registrars return the removed keys in `removedKeys`.

When creating a DID fails, Credo deletes the key it created for it. For ledger methods it does so only when the failure comes before the ledger write, or when the ledger rejects the write (did:cheqd). Other failures, such as a timeout, can still reach the ledger, so Credo keeps the key that controls the DID.

| Method | Keys | Deactivate |
|---|---|---|
| did:key, did:jwk, did:peer (through `dids.create`) | Credo with `createKey`, or yours with `keyId` / `keys` | Only changes the local record, nothing is published |
| did:webvh | Credo, one Ed25519 key that is both the verification method and the update key | Not supported, see Known gaps |
| did:cheqd | Credo with `createKey`, or yours with `keyId` / `keys` | On the ledger |
| did:hedera | Credo (Ed25519 root key), or yours with `rootKeyId` | On the ledger |
| did:indy | Credo (Ed25519), or yours with `keyId` | Not supported, see Known gaps |

The did:peer DIDs Credo creates for DIDComm are deleted with their records, see DIDComm.

## DIDComm

### Routing keys

`DidCommRoutingService.getRouting` creates an Ed25519 recipient key and, when DIDComm v2 is enabled, a keyAgreement key (X25519 by default). Credo calls it when you pass no `routing`, `ourDid` or `invitationDid`, for:

- an invitation: the v1 inline service keys, or the v2 invitation's did:peer
- a connection's did:peer: the DID Exchange request, the response (when the invitation is reusable or has no inline services), and accepting a v2 invitation
- a DID rotation, including a v2 inviter rotating away from a reusable or implicit invitation DID
- the connection to a mediator, when the mediation recipient provisions mediation
- a connectionless exchange, stored as the recipient routing of its out-of-band record (it needs one)

An invitation passes its keys or DID on:

- A single-use v1 invitation with inline services: the inviter's connection DID uses the invitation key.
- A v2 invitation: the inviter's connection uses the invitation DID. On a reusable invitation the connection then rotates to its own DID and keeps the invitation DID in `previousDids`.
- Connectionless: when the exchange turns into a connection, the invitee's connection DID uses the routing stored on the invitation.

A mediator routes messages for the keys registered with it. In a tenant, Credo also creates a tenant routing record in the root agent that maps the recipient key to the tenant.

### Ownership and deletion

Connections and out-of-band records list the DIDs and keys (as `KmsKeyReference`) Credo created for them in their `_internal/createdKeys` metadata. That includes the keys and DID an invitation passes on, so an invitation and its connections can hold the same ones. Routing, DIDs and keys you pass in aren't recorded unless you set `deleteWithRecord: true` on the routing, which records its keys on the record you pass it to. A DID Credo created for one record is recorded only there, so don't pass it as `ourDid` for another record: deleting the first record deletes it.

Nothing is deleted unless you ask:

- `connections.deleteById(id, { deleteAssociatedKeys: true })` deletes the connection's recorded DIDs (current, previous and from failed rotations) and keys.
- `connections.hangup({ connectionId, deleteAfterHangup: true, deleteAssociatedKeys: true })` does the same after the hang-up.
- `oob.deleteById(id, { deleteAssociatedKeys: true })` deletes the invitation's recorded keys and DID, for single-use and reusable invitations.
- `mediationRecipient.deleteRouting(routing)` deletes routing you created with `mediationRecipient.getRouting`.

Routing with `deleteWithRecord` is deleted with the record you passed it to, even when other records use it too. Use it for one record only, or leave it off and call `mediationRecipient.deleteRouting` once the last record that uses the routing is deleted.

Deleting a key or DID also removes it from the mediator and deletes its tenant routing record (`DidCommRoutingDeletedEvent`). Removing it from the mediator is best-effort: when that fails, Credo logs a warning and still deletes the key.

A DID or key that an invitation and its connections share stays until the last of them is deleted. Deleting a connection keeps what the invitation or another connection from it recorded, and deleting an invitation keeps what its connections recorded. Delete them one after the other: deleted in parallel, each sees the other and keeps the shared DID or key, so nothing deletes it.

| Situation | Deleting the connection with `deleteAssociatedKeys` |
|---|---|
| Invitation with a public DID (`invitationDid`, or an implicit invitation) | Deletes the connection's own did:peer (for v2, the DID it rotated to) and its keys. The public DID is yours and stays |
| v2 reusable invitation | Deletes the DID the inviter rotated to and its keys. The invitation DID stays while the invitation or another connection from it exists, otherwise it is deleted too |
| Single-use v1 invitation | Deletes the connection DID. The invitation key it reuses stays until the invitation is deleted too |
| Reusable v1 invitation | Deletes the connection's own DID and keys. The invitation key stays while the invitation exists |
| Connection to a mediator | Deletes the connection's DID and the keys of the routing the mediation recipient created for it |

### Rotation

DID rotation (v1 and v2) creates a new did:peer with new keys and moves the old DID to `previousDids`, so late messages to it still arrive. The old DIDs and keys stay until the connection is deleted with `deleteAssociatedKeys`.

When several first messages from one peer on a v2 reusable or implicit invitation arrive at once, each rotates to a new DID but only one connection is stored. Credo deletes the DIDs and keys of the others.

### Mediator routing keys

The mediator creates its routing keys when it starts and stores them on the `DidCommMediatorRoutingRecord`: an Ed25519 key for DIDComm v1 forwards and, when DIDComm v2 is enabled, an X25519 key for v2 forwards. They are long-lived and have no rotation API. Credo only deletes keys when two instances race to create the record, and then only the extra ones.

## X.509 certificates

Credo creates no keys for certificates and never deletes the keys they use. The X.509 API signs with KMS keys you pass in as `PublicJwk` with a `keyId`, and stores no certificates.

| Key | Used by | Delete it when |
|---|---|---|
| Authority key (root or intermediate CA) | `x509.createCertificate` and `x509.createCertificateRevocationList` (`authorityKey`) | You no longer issue certificates or revocation lists with it. Rotate by creating a new CA key and certificate |
| Subject key (leaf certificate, CSR) | `x509.createCertificate` (`subjectPublicKey`), `x509.createCertificateSigningRequest` | The certificate is replaced and nothing signs with the key. Rotate by creating a new key and certificate |
| Signing keys behind certificates | mdoc issuer signing, mdoc reader authentication, SD-JWT VC and OID4VP request signing with `x5c` | You stop signing with it. Verifiers only need the certificate |

Trusted certificates and certificate chains you configure hold only public keys.

## Not KMS keys

AnonCreds link secrets, credential definition private keys and revocation registry private data are records, not KMS keys.

## Known gaps

- DIDComm records created before the `_internal/createdKeys` metadata existed record no keys, so `deleteAssociatedKeys` deletes nothing for them.
- `CheqdDidRegistrar.update` with `createKey` leaves the new key when the update fails.
- DIDComm doesn't delete routing keys when the operation that created them fails, such as registering them with the mediator in `getRouting` or creating the invitation, connection or rotation afterwards. The exception is a failed rotation of a v2 inviter away from a reusable or implicit invitation DID: Credo deletes the new DID and keys and keeps using the invitation DID.
- did:indy and did:webvh can't be deactivated, so after `deleteCreatedDid` with `deleteActiveDid` a did:indy stays active on the ledger and a published did:webvh log stays active.
