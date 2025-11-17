import {
  Agent,
  DidCommV1Service,
  DidDocument,
  DidDocumentBuilder,
  getEd25519VerificationKey2018,
  getJsonWebKey2020,
  Kms,
  TypedArrayEncoder,
  utils,
} from '@credo-ts/core'
import { transformPrivateKeyToPrivateJwk } from '../../askar/src'

import { getAgentOptions } from '../../core/tests/helpers'
import type { CheqdDidCreateOptions, CheqdDidUpdateOptions } from '../src'
import { cheqdPayerSeeds, getCheqdModules } from './setupCheqdModule'
import { validService } from './testUtils'

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

    // biome-ignore lint/correctness/noUnusedVariables: no explanation
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

  it('should create a did:cheqd using JsonWebKey2020 and update with serviceEndpoint as array', async () => {
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

  it('should create a did:cheqd using JsonWebKey2020 update it with a new key, and the remove the key', async () => {
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
      // Did document with added service
      didDocument,
      // Create new key
      options: {
        createKey: {
          type: {
            crv: 'Ed25519',
            kty: 'OKP',
          },
        },
      },
    })
    expect(updateResult.didState.state).toEqual('finished')
    expect(updateResult.didState.didDocument?.toJSON()).toEqual({
      id: did,
      '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/suites/jws-2020/v1'],
      assertionMethod: [`${did}#key-1`],
      authentication: [`${did}#key-1`],
      controller: [did],
      service: [
        {
          id: `${did}#service-1`,
          serviceEndpoint: ['https://rand.io'],
          type: 'CustomType',
        },
      ],
      verificationMethod: [
        {
          controller: did,
          id: `${did}#key-1`,
          publicKeyJwk: {
            crv: 'Ed25519',
            kty: 'OKP',
            x: expect.any(String),
          },
          type: 'JsonWebKey2020',
        },
        {
          controller: did,
          id: `${did}#key-2`,
          publicKeyJwk: {
            crv: 'Ed25519',
            kty: 'OKP',
            x: expect.any(String),
          },
          type: 'JsonWebKey2020',
        },
      ],
    })

    // Now remove the last entry
    didDocument.authentication?.pop()

    const removeResult = await agent.dids.update<CheqdDidUpdateOptions>({
      did,
      didDocument,
    })

    expect(removeResult.didState.state).toEqual('finished')
    expect(removeResult.didState.didDocument?.toJSON()).toEqual({
      id: did,
      '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/suites/jws-2020/v1'],
      assertionMethod: [`${did}#key-1`],
      authentication: [`${did}#key-1`],
      controller: [did],
      service: [
        {
          id: `${did}#service-1`,
          serviceEndpoint: ['https://rand.io'],
          type: 'CustomType',
        },
      ],
      verificationMethod: [
        {
          controller: did,
          id: `${did}#key-1`,
          publicKeyJwk: {
            crv: 'Ed25519',
            kty: 'OKP',
            x: expect.any(String),
          },
          type: 'JsonWebKey2020',
        },
      ],
    })
  })

  it('should create a did:cheqd using JsonWebKey2020 and update with DidCommV1Service', async () => {
    const createResult = await agent.dids.create<CheqdDidCreateOptions>({
      method: 'cheqd',
      options: {
        createKey: {
          type: {
            crv: 'Ed25519',
            kty: 'OKP',
          },
          keyId: 'another-key-id',
        },
        network: 'testnet',
        methodSpecificIdAlgo: 'uuid',
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
