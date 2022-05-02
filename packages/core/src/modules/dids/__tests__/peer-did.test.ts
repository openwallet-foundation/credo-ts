import type { IndyLedgerService } from '../../ledger'

import { getAgentConfig } from '../../../../tests/helpers'
import { KeyType } from '../../../crypto'
import { IndyStorageService } from '../../../storage/IndyStorageService'
import { JsonTransformer } from '../../../utils'
import { IndyWallet } from '../../../wallet/IndyWallet'
import { DidCommV1Service, DidDocument, DidDocumentBuilder, Key } from '../domain'
import { DidDocumentRole } from '../domain/DidDocumentRole'
import { convertPublicKeyToX25519, getEd25519VerificationMethod } from '../domain/key-type/ed25519'
import { getX25519VerificationMethod } from '../domain/key-type/x25519'
import { DidKey } from '../methods/key'
import { DidPeer, PeerDidNumAlgo } from '../methods/peer/DidPeer'
import { DidRecord, DidRepository } from '../repository'
import { DidResolverService } from '../services'

import didPeer1zQmY from './__fixtures__/didPeer1zQmY.json'

describe('peer dids', () => {
  const config = getAgentConfig('Peer DIDs Lifecycle')

  let didRepository: DidRepository
  let didResolverService: DidResolverService
  let wallet: IndyWallet

  beforeEach(async () => {
    wallet = new IndyWallet(config)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await wallet.createAndOpen(config.walletConfig!)

    const storageService = new IndyStorageService<DidRecord>(wallet, config)
    didRepository = new DidRepository(storageService)

    // Mocking IndyLedgerService as we're only interested in the did:peer resolver
    didResolverService = new DidResolverService(config, {} as unknown as IndyLedgerService, didRepository)
  })

  afterEach(async () => {
    await wallet.delete()
  })

  test('create a peer did method 1 document from ed25519 keys with a service', async () => {
    // The following scenario show how we could create a key and create a did document from it for DID Exchange

    const { verkey: publicKeyBase58 } = await wallet.createDid({ seed: 'astringoftotalin32characterslong' })
    const { verkey: mediatorPublicKeyBase58 } = await wallet.createDid({ seed: 'anotherstringof32characterslong1' })

    const ed25519Key = Key.fromPublicKeyBase58(publicKeyBase58, KeyType.Ed25519)
    const x25519Key = Key.fromPublicKey(convertPublicKeyToX25519(ed25519Key.publicKey), KeyType.X25519)

    const ed25519VerificationMethod = getEd25519VerificationMethod({
      // The id can either be the first 8 characters of the key data (for ed25519 it's publicKeyBase58)
      // uuid is easier as it is consistent between different key types. Normally you would dynamically
      // generate the uuid, but static for testing purposes
      id: `#d0d32199-851f-48e3-b178-6122bd4216a4`,
      key: ed25519Key,
      // For peer dids generated with method 1, the controller MUST be #id as we don't know the did yet
      controller: '#id',
    })
    const x25519VerificationMethod = getX25519VerificationMethod({
      // The id can either be the first 8 characters of the key data (for ed25519 it's publicKeyBase58)
      // uuid is easier as it is consistent between different key types. Normally you would dynamically
      // generate the uuid, but static for testing purposes
      id: `#08673492-3c44-47fe-baa4-a1780c585d75`,
      key: x25519Key,
      // For peer dids generated with method 1, the controller MUST be #id as we don't know the did yet
      controller: '#id',
    })

    const mediatorEd25519Key = Key.fromPublicKeyBase58(mediatorPublicKeyBase58, KeyType.Ed25519)
    const mediatorEd25519DidKey = new DidKey(mediatorEd25519Key)

    const mediatorX25519Key = Key.fromPublicKey(convertPublicKeyToX25519(mediatorEd25519Key.publicKey), KeyType.X25519)
    // Use ed25519 did:key, which also includes the x25519 key used for didcomm
    const mediatorRoutingKey = `${mediatorEd25519DidKey.did}#${mediatorX25519Key.fingerprint}`

    const service = new DidCommV1Service({
      id: '#service-0',
      // Fixme: can we use relative reference (#id) instead of absolute reference here (did:example:123#id)?
      // We don't know the did yet
      recipientKeys: [ed25519VerificationMethod.id],
      serviceEndpoint: 'https://example.com',
      accept: ['didcomm/aip2;env=rfc19'],
      // It is important that we encode the routing keys as key references.
      // So instead of using plain verkeys, we should encode them as did:key dids
      routingKeys: [mediatorRoutingKey],
    })

    const didDocument =
      // placeholder did, as it is generated from the did document
      new DidDocumentBuilder('')
        // ed25519 authentication method for signatures
        .addAuthentication(ed25519VerificationMethod)
        // x25519 for key agreement
        .addKeyAgreement(x25519VerificationMethod)
        .addService(service)
        .build()

    const peerDid = DidPeer.fromDidDocument(didDocument, PeerDidNumAlgo.GenesisDoc)

    expect(peerDid.did).toBe(didPeer1zQmY.id)
    expect(peerDid.didDocument).toMatchObject(didPeer1zQmY)

    // Save the record to storage
    const didDocumentRecord = new DidRecord({
      id: didPeer1zQmY.id,
      role: DidDocumentRole.Created,
      // It is important to take the did document from the PeerDid class
      // as it will have the id property
      didDocument: peerDid.didDocument,
      tags: {
        // We need to save the recipientKeys, so we can find the associated did
        // of a key when we receive a message from another connection.
        recipientKeyFingerprints: peerDid.didDocument.recipientKeys.map((key) => key.fingerprint),
      },
    })

    await didRepository.save(didDocumentRecord)
  })

  test('receive a did and did document', async () => {
    // This flow assumes peer dids. When implementing for did exchange other did methods could be used

    // We receive the did and did document from the did exchange message (request or response)
    const did = didPeer1zQmY.id

    // Note that the did document could be undefined (if inlined did:peer or public did)
    const didDocument = JsonTransformer.fromJSON(didPeer1zQmY, DidDocument)

    // Create a did peer instance from the did document document, or only the did if no did document provided
    const didPeer = didDocument ? DidPeer.fromDidDocument(didDocument) : DidPeer.fromDid(did)

    // make sure the dids are valid by matching them against our encoded variants
    expect(didPeer.did).toBe(did)

    // If a did document was provided, we match it against the did document of the peer did
    // This validates whether we get the same did document
    if (didDocument) {
      expect(didPeer.didDocument.toJSON()).toMatchObject(didPeer1zQmY)
    }

    const didDocumentRecord = new DidRecord({
      id: didPeer.did,
      role: DidDocumentRole.Received,
      // If the method is a genesis doc (did:peer:1) we should store the document
      // Otherwise we only need to store the did itself (as the did can be generated)
      didDocument: didPeer.numAlgo === PeerDidNumAlgo.GenesisDoc ? didPeer.didDocument : undefined,
      tags: {
        // We need to save the recipientKeys, so we can find the associated did
        // of a key when we receive a message from another connection.
        recipientKeyFingerprints: didPeer.didDocument.recipientKeys.map((key) => key.fingerprint),
      },
    })

    await didRepository.save(didDocumentRecord)

    // Then we save the did (not the did document) in the connection record
    // connectionRecord.theirDid = didPeer.did

    // Then when we want to send a message we can resolve the did document
    const { didDocument: resolvedDidDocument } = await didResolverService.resolve(didPeer.did)
    expect(resolvedDidDocument).toBeInstanceOf(DidDocument)
    expect(resolvedDidDocument?.toJSON()).toMatchObject(didPeer1zQmY)
  })
})
