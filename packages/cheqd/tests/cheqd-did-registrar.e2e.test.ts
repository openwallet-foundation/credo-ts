import type { CheqdDidCreateOptions } from '../src'
import type { DidDocument } from '@credo-ts/core'

import {
  Agent,
  DidCommV1Service,
  DidDocumentBuilder,
  getEd25519VerificationKey2018,
  getJsonWebKey2020,
  KeyType,
  utils,
  TypedArrayEncoder,
} from '@credo-ts/core'
import { generateKeyPairFromSeed } from '@stablelib/ed25519'

import { getInMemoryAgentOptions } from '../../core/tests/helpers'

import { validService } from './setup'
import { cheqdPayerSeeds, getCheqdModules } from './setupCheqdModule'

const agentOptions = getInMemoryAgentOptions('Faber Dids Registrar', {}, getCheqdModules(cheqdPayerSeeds[0]))

describe('Cheqd DID registrar', () => {
  let agent: Agent<ReturnType<typeof getCheqdModules>>

  beforeAll(async () => {
    agent = new Agent(agentOptions)
    await agent.initialize()
  })

  afterAll(async () => {
    await agent.shutdown()
    await agent.wallet.delete()
  })

  it('should create a did:cheqd did', async () => {
    // Generate a seed and the cheqd did. This allows us to create a new did every time
    // but still check if the created output document is as expected.
    const privateKey = TypedArrayEncoder.fromString(
      Array(32 + 1)
        .join((Math.random().toString(36) + '00000000000000000').slice(2, 18))
        .slice(0, 32)
    )
    const publicKeyEd25519 = generateKeyPairFromSeed(privateKey).publicKey
    const ed25519PublicKeyBase58 = TypedArrayEncoder.toBase58(publicKeyEd25519)
    const did = await agent.dids.create<CheqdDidCreateOptions>({
      method: 'cheqd',
      secret: {
        verificationMethod: {
          id: 'key-1',
          type: 'Ed25519VerificationKey2018',
          privateKey,
        },
      },
      options: {
        network: 'testnet',
        methodSpecificIdAlgo: 'base58btc',
      },
    })
    expect(did).toMatchObject({
      didState: {
        state: 'finished',
        didDocument: {
          verificationMethod: [
            {
              type: 'Ed25519VerificationKey2018',
              publicKeyBase58: ed25519PublicKeyBase58,
            },
          ],
        },
      },
    })
  })

  it('should create a did:cheqd using Ed25519VerificationKey2020', async () => {
    const did = await agent.dids.create<CheqdDidCreateOptions>({
      method: 'cheqd',
      secret: {
        verificationMethod: {
          id: 'key-1',
          type: 'Ed25519VerificationKey2020',
        },
      },
      options: {
        network: 'testnet',
        methodSpecificIdAlgo: 'uuid',
      },
    })
    expect(did.didState).toMatchObject({ state: 'finished' })
  })

  it('should create a did:cheqd using JsonWebKey2020 and update with serviceEndpoint as array', async () => {
    const createResult = await agent.dids.create<CheqdDidCreateOptions>({
      method: 'cheqd',
      secret: {
        verificationMethod: {
          id: 'key-11',
          type: 'JsonWebKey2020',
        },
      },
      options: {
        network: 'testnet',
        methodSpecificIdAlgo: 'base58btc',
      },
    })

    expect(createResult).toMatchObject({
      didState: {
        state: 'finished',
        didDocument: {
          verificationMethod: [{ type: 'JsonWebKey2020' }],
        },
      },
    })
    expect(createResult.didState.did).toBeDefined()
    const did = createResult.didState.did as string
    const didDocument = createResult.didState.didDocument as DidDocument
    didDocument.service = [validService(did)]

    const updateResult = await agent.dids.update({
      did,
      didDocument,
    })
    expect(updateResult).toMatchObject({
      didState: {
        state: 'finished',
        didDocument,
      },
    })
    expect(updateResult.didState.didDocument?.toJSON()).toMatchObject(didDocument.toJSON())
    const deactivateResult = await agent.dids.deactivate({ did })
    expect(deactivateResult.didState.didDocument?.toJSON()).toMatchObject(didDocument.toJSON())
    expect(deactivateResult.didState.state).toEqual('finished')

    const resolvedDocument = await agent.dids.resolve(did, {
      useLocalCreatedDidRecord: false,
    })
    expect(resolvedDocument.didDocumentMetadata.deactivated).toBe(true)
  })
  it('should create a did:cheqd using Ed25519VerificationKey2020 and update with DidCommV1Service', async () => {
    const createResult = await agent.dids.create<CheqdDidCreateOptions>({
      method: 'cheqd',
      secret: {
        verificationMethod: {
          id: 'key-1',
          type: 'Ed25519VerificationKey2020',
        },
      },
      options: {
        network: 'testnet',
        methodSpecificIdAlgo: 'uuid',
      },
    })
    expect(createResult).toMatchObject({
      didState: {
        state: 'finished',
        didDocument: {
          verificationMethod: [{ type: 'Ed25519VerificationKey2020' }],
        },
      },
    })
    expect(createResult.didState.did).toBeDefined()
    const did = createResult.didState.did as string
    const didDocument = createResult.didState.didDocument as DidDocument
    const verificationMethodId = didDocument.verificationMethod?.[0]?.id
    const service1 = new DidCommV1Service({
      id: `${did}#didcomm-1`,
      serviceEndpoint: 'https://this.endpoint.io',
      recipientKeys: [verificationMethodId ?? ''],
      accept: ['didcomm/aip2;env=rfc19'],
      priority: 0,
    })
    didDocument.service = [service1]
    const updateResult = await agent.dids.update({
      did,
      didDocument,
    })
    expect(updateResult).toMatchObject({
      didState: {
        state: 'finished',
        didDocument,
      },
    })
    expect(updateResult.didState.didDocument?.toJSON()).toMatchObject(didDocument.toJSON())
  })

  it('should create a did:cheqd did using custom did document containing Ed25519 key', async () => {
    const did = `did:cheqd:testnet:${utils.uuid()}`

    const ed25519Key = await agent.wallet.createKey({
      keyType: KeyType.Ed25519,
    })

    const createResult = await agent.dids.create<CheqdDidCreateOptions>({
      method: 'cheqd',
      didDocument: new DidDocumentBuilder(did)
        .addController(did)
        .addAuthentication(`${did}#${ed25519Key.fingerprint}`)
        .addVerificationMethod(
          getEd25519VerificationKey2018({
            key: ed25519Key,
            controller: did,
            id: `${did}#${ed25519Key.fingerprint}`,
          })
        )
        .build(),
    })

    expect(createResult).toMatchObject({
      didState: {
        state: 'finished',
      },
    })

    expect(createResult.didState.didDocument?.toJSON()).toMatchObject({
      '@context': [
        'https://w3id.org/did/v1',
        'https://w3id.org/security/suites/ed25519-2018/v1',
        'https://www.w3.org/ns/did/v1',
      ],
      verificationMethod: [
        {
          controller: did,
          type: 'Ed25519VerificationKey2018',
          publicKeyBase58: ed25519Key.publicKeyBase58,
        },
      ],
    })
  })

  it('should create a did:cheqd did using custom did document containing P256 key', async () => {
    const did = `did:cheqd:testnet:${utils.uuid()}`

    const p256Key = await agent.wallet.createKey({
      keyType: KeyType.P256,
    })

    const createResult = await agent.dids.create<CheqdDidCreateOptions>({
      method: 'cheqd',
      didDocument: new DidDocumentBuilder(did)
        .addController(did)
        .addAuthentication(`${did}#${p256Key.fingerprint}`)
        .addVerificationMethod(
          getJsonWebKey2020({
            did,
            key: p256Key,
            verificationMethodId: `${did}#${p256Key.fingerprint}`,
          })
        )
        .build(),
    })

    // FIXME: the ES256 signature generated by Credo is invalid for Cheqd
    // need to dive deeper into it, but for now adding a failing test so we can fix it in the future
    expect(createResult).toMatchObject({
      didState: {
        state: 'failed',
      },
    })
  })
})
