# Key lifecycle

This document lists the KMS keys Credo creates or uses, how long they live, how they rotate, and who deletes them. Following it should leave no dangling keys. Update it with every change that creates, stores, uses, rotates or deletes a key.

## Rules

- Credo deletes a key it created for a session (OID4VP and mdoc verification sessions, OpenID4VCI issuance sessions) together with the session by default. Opt out with `deleteAssociatedKey: false`, or `deleteAssociatedDpopKey: false` for issuance sessions. Nothing else uses these keys.
- Keys of credentials, connections and invitations are only deleted when you pass `deleteAssociatedKeys: true`, because you may have passed them in or another record may share them. Keys of DIDs only with `deleteAssociatedKeys` or `deleteRemovedKeys`, see DIDs.
- When the operation that creates a session key, a rotated issuer key or a DID fails before anything was published, Credo deletes the key again. DIDComm doesn't, see Known gaps.
- A key you created or passed in (a `keyId`, `routing`, `ourDid`, a binding resolver, configured keys) is only deleted by an option that deletes the keys of a record: `deleteRemovedKeys` for DIDs, `deleteAssociatedKeys` on DIDs, credentials and DIDComm records with `routing` that has `deleteWithRecord`, or deleting the previous keys of an issuer. These options don't check whether another DID or record still uses the key. The tables say when you should delete the other keys yourself.
- When `deleteAssociatedKeys` or deleting the previous keys of an issuer can't delete every key, it throws `KeyManagementKeysNotDeletedError` and keeps the record or the keys it couldn't delete. Call it again to retry. A key that is already gone counts as deleted. `deleteRemovedKeys` on DIDs logs a key it can't delete instead, because the DID update is already done.
- A key falls in one of three lifetimes:
  - **ephemeral**: created inside one KMS operation and never stored.
  - **per record**: lives as long as a session, invitation, connection, credential or DID record.
  - **long-lived**: belongs to a component (issuer, mediator) and only changes on rotation.

## Backends

- `agent.kms.createKey` and `createKeyForSignatureAlgorithm` use the given `backend`, otherwise the default backend. They return the `backend` that created the key.
- `agent.kms.deleteKey` with `backend` deletes from that backend. Without it, it deletes from the backend that holds the key. It returns `false` when no backend has the key.
- Records store a key as a `KmsKeyReference` (`keyId` and `kmsBackend`), and Credo deletes it with that backend. Keys stored before the backend was recorded are looked up in each backend.
- Deleting a tenant (`TenantsApi.deleteTenantById`) removes the tenant's keys only on Askar, which removes the tenant's profile or store. The Node backend (`NodeKeyManagementStorage`) and the secure environment backend have no per-tenant cleanup, so delete the tenant's keys before you delete the tenant. Secure environment keys are not scoped to a tenant at all.
- The secure environment backend only creates P-256 keys and signs with ES256. Keys Credo creates for decryption (the OID4VP response key, the mdoc session key) can't be used there. Make another backend the default when you need them.

## Ephemeral keys

These keys are created inside the KMS backend for one operation and freed afterwards. Nothing to delete.

| Use | Where |
|---|---|
| ECDH-ES, ECDH-1PU and HPKE ephemeral keys, wrapped content keys | `encrypt` in the Askar and Node backends |
| DIDComm v1 envelopes (content key, anoncrypt box) | `DidCommEnvelopeService` |
| DIDComm v2 envelopes (ECDH-ES+A256KW, ECDH-1PU+A256KW) | `DidCommV2EnvelopeService`. The sender key in authcrypt is the DID's keyAgreement key, see DIDComm |
| JWE for an OID4VP response (holder) and an encrypted credential response (issuer) | `JweService` |
| mdoc DC API response (holder, HPKE seal) | `mdocContext` |

## OpenID4VC

| Key | Created by | Lifetime and rotation | Deleted |
|---|---|---|---|
| OID4VP response encryption key (verifier), P-256 | Credo, for every authorization request with `direct_post.jwt` or `dc_api.jwt` | Per verification session, stored as `responseEncryptionKey`. Sessions from before that field published the key id as the `kid` of the `use: 'enc'` key in the request's `client_metadata.jwks`, or before Credo 0.6 its fingerprint, with the key stored under its legacy key id | By `verifier.deleteVerificationSessionById` unless `deleteAssociatedKey: false`. Also when `createAuthorizationRequest` fails after creating it. Not on expiry: delete expired sessions to delete their keys |
| Access token signing key (issuer), Ed25519 by default | Credo, in `createIssuer` and `rotateAccessTokenSigningKey`, or you with `accessTokenSigner` | Long-lived, stored as `accessTokenKey` on the issuer record. `rotateAccessTokenSigningKey` moves the current key to `previousAccessTokenKeys`, where it still verifies access tokens it signed | With `deletePreviousAccessTokenSigningKeys`. `deleteFromKms: false` only removes them from the issuer. A key Credo created in `rotateAccessTokenSigningKey` is also deleted when storing the rotation fails. Issuers can't be deleted |
| Chained authorization server DPoP key, configured (issuer towards an external authorization server) | You, as `dpop.keyId` of a chained authorization server config on the issuer record (`authorizationServerConfigs`) | Long-lived, used by every issuance session of that authorization server. Changing `dpop.keyId` only affects new sessions | Never by Credo. Delete it yourself once no open issuance session uses it |
| Chained authorization server DPoP key, generated | Credo, at the PAR request, when no `dpop.keyId` is configured | Per issuance session, stored in `chainedIdentity.externalDpop` with `keyGeneratedForSession: true` | By `issuer.deleteIssuanceSessionById` unless `deleteAssociatedDpopKey: false`. Also when saving the session fails at PAR |
| Credential request encryption keys (issuer) | You, in `credentialRequestEncryption.keys`, or Credo with `rotateCredentialRequestEncryptionKey` | Long-lived, stored with their backend. `rotateCredentialRequestEncryptionKey` advertises a new key (created in the backend of the current key, or the `key` you pass) and moves the current keys to `previousKeys`, where they still decrypt requests but are no longer advertised | With `deletePreviousCredentialRequestEncryptionKeys`, which removes keys from `previousKeys` and deletes them. `deleteFromKms: false` only removes them from the issuer. A key Credo created in `rotateCredentialRequestEncryptionKey` is also deleted when storing the rotation fails. Keys you remove from the configuration yourself (`updateIssuerMetadata`) are not deleted |
| Credential response encryption key (holder), P-256 | Credo, for a credential or deferred credential request that asks for an encrypted response | One request. Not stored | By Credo, when the request finishes or fails |
| Holder DPoP key | Credo, in the authorization or token request when you pass no `dpop` | One issuance flow. Not stored. Returned to you as `dpop` and reused for the credential and notification requests | Never by Credo. Delete it yourself after the last request of the flow |
| Wallet and client attestation keys | You | As long as the attestation is valid | Never by Credo. Delete it yourself when you replace the attestation |
| Credential binding keys, SD-JWT VC and mdoc (holder) | You, through `credentialBindingResolver` | Per credential, stored as `credentialInstances[].kmsKeyId` and `kmsBackend`. Used instances stay on the record | By `sdJwtVc.deleteById` and `mdoc.deleteById` with `deleteAssociatedKeys: true` (off by default). Instances stored without a `kmsKeyId` delete the key under the legacy key id of their holder key |
| Credential binding DIDs, OpenID4VCI and DIDComm (holder). W3C credentials only bind to DIDs | You, through `credentialBindingResolver`, the `didCommSignedAttachment` `kid`, or the `credentialSubject.id` of a JSON-LD credential | With `deleteWithRecord: true` (or `deleteDidWithRecord` in the JSON-LD format), the credential record stores the DIDs in its `_internal/holderBindingDids` metadata. Only for DIDs whose method has no deactivation, such as did:key, did:jwk and did:peer. For other DIDs it throws. Until the credential is stored, the DIDComm credential exchange record holds them. Otherwise the DID is yours and lives on its own | By the credential's `deleteById` (`sdJwtVc`, `mdoc`, `w3cCredentials`, `w3cV2Credentials`) with `deleteAssociatedKeys: true`, which deletes the DID records and their keys. `credentials.deleteById` with `deleteAssociatedKeys: true` does this for the credentials of a DIDComm exchange, and for the DIDs of credentials that were never stored. A DID without `deleteWithRecord` is never deleted with the credential. Delete it yourself, see DIDs |

## mdoc

| Key | Created by | Lifetime and rotation | Deleted |
|---|---|---|---|
| DC API session key (verifier), P-256 | Credo, in `createDcApiVerificationSession` | Per verification session, stored as `sessionKey` | By `mdoc.deleteVerificationSessionById` unless `deleteAssociatedKey: false`. Also when creating the request fails. Not on expiry |

The holder's device key is a credential binding key, see OpenID4VC.

## DIDs

A DID record links its document to KMS keys in `keys[{ kmsKeyId, didDocumentRelativeKeyId }]`. The keys live as long as the DID.

- **Deactivate:** `dids.deactivate({ did })` deactivates the DID and sets the status of its record to `deactivated`. The DID can then no longer be updated. It doesn't delete the record or the keys. A did:cheqd or did:hedera that is already deactivated on the ledger only gets its record marked. A DID this agent didn't create can't be deactivated. Only the `deactivated` status is reliable in a query: Askar records stored before the status existed have no `status` tag, so find active DIDs with `$not: { status: 'deactivated' }`.
- **Failed create:** when creating a DID fails, a key Credo created for it is deleted. For ledger methods only when the failure is before the write to the ledger, or when the ledger rejects the write (did:cheqd). A write that fails in another way, such as a timeout, can still reach the ledger, so the key that controls the DID is kept.
- **Delete:** `dids.deleteCreatedDid({ did, deleteAssociatedKeys })` deletes the DID record, and with `deleteAssociatedKeys: true` its keys. For a record without `keys` it deletes the legacy key id of each verification method in the stored DID document, or else in the resolved one. When the DID doesn't resolve, it logs a warning and deletes only the record. It doesn't deactivate the DID. It throws for a DID that isn't deactivated, so call `deactivate` first or pass `deleteActiveDid: true`. A DID method without deactivation (`deactivationSupport: 'notSupportedByMethod'`: did:key, did:jwk and did:peer) can always be deleted. When the registrar doesn't implement deactivation (did:indy and did:webvh) or no registrar supports the method, only `deleteActiveDid: true` deletes it. A did:webvh record holds the DID log, so keep it as long as you publish the log.
- **Removed verification methods:** `dids.update({ did, didDocument, deleteRemovedKeys })`. After the update, `deleteRemovedKeys` deletes the keys of the verification methods it removed, unless a remaining verification method uses the same key. It works for did:cheqd and did:hedera, whose registrars return the removed keys in `removedKeys` of the update result.

| Method | Keys | Deactivate | Deleted |
|---|---|---|---|
| did:key, did:jwk, did:peer (created through `dids.create`) | Credo with `createKey`, or yours with `keyId` / `keys` | Nothing is published, so deactivate only changes the local DID record | With `deleteCreatedDid`. On a failed create |
| did:webvh | Credo, one Ed25519 key that is both the verification method and the update key | Not supported | With `deleteCreatedDid` and `deleteActiveDid`, see Known gaps. On a failed create |
| did:cheqd | Credo with `createKey`, or yours with `keyId` / `keys` | On the ledger | With `deleteCreatedDid`, with `update` and `deleteRemovedKeys`. On a failed create before the ledger write |
| did:hedera | Credo (Ed25519 root key) or yours with `rootKeyId` | On the ledger | With `deleteCreatedDid`, with `update` and `deleteRemovedKeys`. On a failed create before publishing |
| did:indy | Credo (Ed25519) or yours with `keyId` | Not supported | With `deleteCreatedDid` and `deleteActiveDid`, see Known gaps. On a failed create before the ledger write |

The did:peer DIDs Credo creates for DIDComm are deleted with their records, see DIDComm.

## DIDComm

### Routing keys

`DidCommRoutingService.getRouting` creates an Ed25519 recipient key and, when DIDComm v2 is enabled, a keyAgreement key (X25519 by default). Credo calls it when you pass no `routing`, `ourDid` or `invitationDid`, for:

- an invitation: the v1 inline service keys, or the v2 invitation's did:peer
- a connection's did:peer: the DID Exchange request, the response (when the invitation is reusable or has no inline services), and accepting a v2 invitation
- a DID rotation, including the rotation of a v2 inviter away from a reusable or implicit invitation DID
- the connection to a mediator, when the mediation recipient provisions mediation
- connectionless exchanges, stored on the out-of-band record as its recipient routing. A connectionless exchange needs an out-of-band record

An invitation passes its keys or DID on:

- A single-use v1 invitation with inline services: the inviter's connection DID uses the invitation key.
- A v2 invitation: the inviter's connection uses the invitation DID. For a reusable invitation the connection then rotates to its own DID and keeps the invitation DID in `previousDids`.
- Connectionless routing: the invitee's connection DID uses the routing the invitation stored, when the exchange turns into a connection.

When a key is registered with a mediator, the mediator routes messages for it. In a tenant, a tenant routing record in the root agent maps the recipient key to the tenant. Credo creates the tenant routing record with the routing.

### Ownership

Connections and out-of-band records store the DIDs and keys (as `KmsKeyReference`) Credo created for them in the `_internal/createdKeys` metadata. That includes the keys and DID an invitation passes on, so the invitation and its connections all hold them. Routing, DIDs and keys you pass in are not recorded, unless you set `deleteWithRecord: true` on the routing. Credo then records its keys for the connection or invitation you pass it to. A DID Credo created for one record is recorded only there, so don't pass it as `ourDid` for another record: deleting the first record deletes it. Records created before this metadata existed record nothing.

### Deletion

Nothing is deleted unless you ask:

- `connections.deleteById(id, { deleteAssociatedKeys: true })` deletes the connection's recorded DIDs (current, previous and from failed rotations) and keys.
- `connections.hangup({ connectionId, deleteAfterHangup: true, deleteAssociatedKeys: true })` does the same after the hang-up.
- `oob.deleteById(id, { deleteAssociatedKeys: true })` deletes the invitation's recorded keys and DID, for single-use and reusable invitations.
- `mediationRecipient.deleteRouting(routing)` deletes routing you created with `mediationRecipient.getRouting`.

Routing with `deleteWithRecord` is deleted with the record you passed it to. Credo doesn't know about other records you passed the same routing to, so deleting one of them deletes the keys the others use. Use such routing for one record only. Otherwise leave `deleteWithRecord` off and delete the routing with `mediationRecipient.deleteRouting` once the last record that uses it is deleted.

Deleting a key or DID this way also removes it from the mediator that routes it and deletes its tenant routing record (`DidCommRoutingDeletedEvent`). Removing it from the mediator is best-effort. When that fails, Credo logs a warning and still deletes the key.

A recorded DID or key stays while a related record recorded it too:

- Deleting a connection keeps what its invitation, or another connection from that invitation, recorded.
- Deleting an invitation keeps what its connections recorded, such as the key a single-use invitation passed on.

Whichever record is deleted last deletes the shared DID or key. Credo doesn't check other records, see Ownership. Delete an invitation and its connections one after the other. When they are deleted in parallel, each sees the other and keeps the shared DID or key, so nothing deletes it.

Examples:

| Situation | Deleting the connection with `deleteAssociatedKeys` |
|---|---|
| Invitation with a public DID (`invitationDid`, or an implicit invitation) | Deletes the connection's own did:peer and keys. The public DID is yours and stays |
| v2 reusable invitation, the inviter rotated to a per-connection DID | Deletes the rotated DID and its keys. The invitation DID (in `previousDids`) stays while the invitation or another connection from it exists, otherwise it is deleted too |
| v2 implicit invitation (public DID), the inviter rotated to a per-connection DID | Deletes the rotated DID and its keys. The public DID is yours and stays |
| Single-use v1 invitation, the connection reuses its key | Deletes the connection DID. The key stays until the invitation is deleted too |
| Reusable v1 invitation | Deletes the connection's own DID and keys. The invitation key stays while the invitation exists |
| Rotated connection | Deletes the current DID and the previous DIDs Credo created, with their keys |
| Connection to a mediator | Deletes the connection's DID and the keys of the routing the mediation recipient created for it |

### Rotation

DID rotation (v1 and v2) creates a new did:peer with new keys and moves the old DID to `previousDids`, so late messages to the old DID still arrive. The old keys stay until the connection is deleted with `deleteAssociatedKeys`.

When first messages from one peer on a v2 reusable or implicit invitation arrive at the same time, each rotates to a new DID but only one connection is stored. Credo deletes the DIDs and keys of the others.

### Mediator routing keys

The mediator creates its routing keys when it starts and stores them on the `DidCommMediatorRoutingRecord`: an Ed25519 key for DIDComm v1 forwards and, when DIDComm v2 is enabled, an X25519 key for DIDComm v2 forwards. The keys are long-lived and have no rotation API. Credo only deletes the extra keys when two instances race to create the record.

## X.509 certificates

Credo creates no keys for certificates. The X.509 API signs with KMS keys you pass in as `PublicJwk` with a `keyId`, and stores no certificates.

| Key | Used by | Lifetime and rotation | Deleted |
|---|---|---|---|
| Authority key (root or intermediate CA) | `x509.createCertificate` and `x509.createCertificateRevocationList` (`authorityKey`) | As long as the CA certificate is valid and you issue or revoke with it. Rotate by creating a new CA key and certificate | Never by Credo. Delete it once you no longer issue certificates or revocation lists with it |
| Subject key (leaf certificate, CSR) | `x509.createCertificate` (`subjectPublicKey`), `x509.createCertificateSigningRequest` | As long as the certificate is valid. Rotate by creating a new key and certificate | Never by Credo. Delete it once the certificate is replaced and nothing signs with it anymore |
| Signing keys behind certificates | mdoc issuer signing, mdoc reader authentication, SD-JWT VC and OID4VP request signing with `x5c` | As long as the certificate is used for signing | Never by Credo. Verifiers only need the certificate, so delete the key when you stop signing with it |

Trusted certificates and certificate chains you configure hold public keys only.

## Not KMS keys

AnonCreds link secrets, credential definition private keys and revocation registry private data are records, not KMS keys.

## Known gaps

- DIDComm records created before the `_internal/createdKeys` metadata existed record no keys, so `deleteAssociatedKeys` deletes nothing for them.
- `CheqdDidRegistrar.update` with `createKey` leaves the new key when the update fails.
- DIDComm doesn't delete routing keys when the operation that created them fails: registering them with the mediator in `getRouting`, or creating the invitation, connection or rotation afterwards. Only a failed rotation of a v2 inviter away from a reusable or implicit invitation DID deletes the DID and keys it created, and keeps using the invitation DID.
- did:indy and did:webvh can't be deactivated, so after `deleteCreatedDid` with `deleteActiveDid` a did:indy stays active on the ledger and a published did:webvh log stays active.
