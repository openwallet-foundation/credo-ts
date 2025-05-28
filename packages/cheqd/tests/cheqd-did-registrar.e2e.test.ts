import type { DidDocument } from '@credo-ts/core'
import type { CheqdDidCreateOptions, CheqdDidUpdateOptions } from '../src'

import {
  Agent,
  DidDocumentBuilder,
  Kms,
  TypedArrayEncoder,
  getEd25519VerificationKey2018,
  getJsonWebKey2020,
  utils,
} from '@credo-ts/core'

import { getAgentOptions } from '../../core/tests/helpers'

import { transformPrivateKeyToPrivateJwk } from '../../askar/src'
import { validService } from './setup'
import { cheqdPayerSeeds, getCheqdModules } from './setupCheqdModule'

const agentOptions = getAgentOptions('Faber Dids Registrar', {}, {}, getCheqdModules(cheqdPayerSeeds[0]))

describe('Cheqd DID registrar', () => {
  let agent: Agent<ReturnType<typeof getCheqdModules>>

  beforeAll(async () => {
    agent = new Agent(agentOptions)
    await agent.initialize()
  })

  afterAll(async () => {
    await agent.shutdown()
  })

  it('should create a did:cheqd did', async () => {
    // Generate a seed and the cheqd did. This allows us to create a new did every time
    // but still check if the created output document is as expected.
    const privateKey = TypedArrayEncoder.fromString(
      Array(32 + 1)
        .join(`${Math.random().toString(36)}00000000000000000`.slice(2, 18))
        .slice(0, 32)
    )
    const { privateJwk } = transformPrivateKeyToPrivateJwk({ type: { crv: 'Ed25519', kty: 'OKP' }, privateKey })
    const createdKey = await agent.kms.importKey({ privateJwk })

    // @ts-ignore
    const { kid, d, ...publicJwk } = createdKey.publicJwk

    const did = await agent.dids.create<CheqdDidCreateOptions>({
      method: 'cheqd',
      options: {
        keyId: createdKey.keyId,
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
              type: 'JsonWebKey2020',
              publicKeyJwk: publicJwk,
            },
          ],
        },
      },
    })
  })

  it('should create a did:cheqd using Ed25519VerificationKey2020', async () => {
    const did = await agent.dids.create<CheqdDidCreateOptions>({
      method: 'cheqd',
      options: {
        createKey: {
          type: {
            crv: 'Ed25519',
            kty: 'OKP',
          },
          keyId: 'custom-key-id',
        },
        network: 'testnet',
        methodSpecificIdAlgo: 'uuid',
      },
    })
    expect(did.didState).toMatchObject({ state: 'finished' })
  })

  it('should create a did:cheqd using JsonWebKey2020', async () => {
    const createResult = await agent.dids.create<CheqdDidCreateOptions>({
      method: 'cheqd',

      options: {
        createKey: {
          type: {
            crv: 'Ed25519',
            kty: 'OKP',
          },
        },
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

    const updateResult = await agent.dids.update<CheqdDidUpdateOptions>({
      did,
      didDocument,
      options: {},
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

  it('should create a did:cheqd did using custom did document containing Ed25519 key', async () => {
    const did = `did:cheqd:testnet:${utils.uuid()}`

    const ed25519Key = await agent.kms.createKey({
      type: {
        crv: 'Ed25519',
        kty: 'OKP',
      },
    })
    const publicJwk = Kms.PublicJwk.fromPublicJwk(ed25519Key.publicJwk)

    const createResult = await agent.dids.create<CheqdDidCreateOptions>({
      method: 'cheqd',
      didDocument: new DidDocumentBuilder(did)
        .addController(did)
        .addAuthentication(`${did}#${publicJwk.fingerprint}`)
        .addVerificationMethod(
          getEd25519VerificationKey2018({
            publicJwk,
            controller: did,
            id: `${did}#${publicJwk.fingerprint}`,
          })
        )
        .build(),
      options: {
        keys: [
          {
            didDocumentRelativeKeyId: `#${publicJwk.fingerprint}`,
            kmsKeyId: ed25519Key.keyId,
          },
        ],
      },
    })

    expect(createResult).toMatchObject({
      didState: {
        state: 'finished',
      },
    })

    expect(createResult.didState.didDocument?.toJSON()).toMatchObject({
      '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/suites/ed25519-2018/v1'],
      verificationMethod: [
        {
          controller: did,
          type: 'Ed25519VerificationKey2018',
          publicKeyBase58: TypedArrayEncoder.toBase58(publicJwk.publicKey.publicKey),
        },
      ],
    })
  })

  it('should create a did:cheqd did using custom did document containing P256 key', async () => {
    const did = `did:cheqd:testnet:${utils.uuid()}`

    const p256Key = await agent.kms.createKey({
      type: { kty: 'EC', crv: 'P-256' },
    })
    const publicJwk = Kms.PublicJwk.fromPublicJwk(p256Key.publicJwk)

    const createResult = await agent.dids.create<CheqdDidCreateOptions>({
      method: 'cheqd',
      options: {
        keys: [
          {
            didDocumentRelativeKeyId: `#${publicJwk.fingerprint}`,
            kmsKeyId: p256Key.keyId,
          },
        ],
      },
      didDocument: new DidDocumentBuilder(did)
        .addController(did)
        .addAuthentication(`${did}#${publicJwk.fingerprint}`)
        .addVerificationMethod(
          getJsonWebKey2020({
            did,
            publicJwk,
            verificationMethodId: `${did}#${publicJwk.fingerprint}`,
          })
        )
        .build(),
    })

    // Somehow this only works with the Node KMS
    expect(createResult).toMatchObject({
      didState: {
        state: 'finished',
      },
    })
  })
})
