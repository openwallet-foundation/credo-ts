import type { CheqdDidCreateOptions } from '../src'
import type { DidDocument } from '@credo-ts/core'

import { Agent, TypedArrayEncoder } from '@credo-ts/core'
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

  it('should create a did:cheqd using JsonWebKey2020', async () => {
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

    const deactivateResult = await agent.dids.deactivate({ did })
    expect(deactivateResult.didState.didDocument?.toJSON()).toMatchObject(didDocument.toJSON())
    expect(deactivateResult.didState.state).toEqual('finished')

    const resolvedDocument = await agent.dids.resolve(did)
    expect(resolvedDocument.didDocumentMetadata.deactivated).toBe(true)
  })
})
