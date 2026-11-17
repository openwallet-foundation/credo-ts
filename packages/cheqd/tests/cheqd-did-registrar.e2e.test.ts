import { generateKeyPairSync } from 'node:crypto'
import { AgentCard, canonicalizeAgentCard, verifyAgentCardSignature as verifyWithA2aSdk } from '@a2a-js/sdk'
import type { DidDocument } from '@credo-ts/core'
import {
  Agent,
  DidCommV1Service,
  DidDocumentBuilder,
  DidRepository,
  getEd25519VerificationKey2018,
  getJsonWebKey2020,
  getPublicJwkFromVerificationMethod,
  Kms,
  TypedArrayEncoder,
  utils,
} from '@credo-ts/core'
import { transformPrivateKeyToPrivateJwk } from '../../askar/src'

import { getAgentOptions } from '../../core/tests/helpers'
import type { CheqdDidCreateOptions, CheqdDidUpdateOptions } from '../src'
import { CheqdDidRegistrar, signAgentCardPayload, verifyAgentCardSignature } from '../src'
import { CheqdLedgerService } from '../src/ledger'
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
    const privateKey = TypedArrayEncoder.fromUtf8String(
      Array(32 + 1)
        .join(`${Math.random().toString(36)}00000000000000000`.slice(2, 18))
        .slice(0, 32)
    )
    const { privateJwk } = transformPrivateKeyToPrivateJwk({ type: { crv: 'Ed25519', kty: 'OKP' }, privateKey })
    const createdKey = await agent.kms.importKey({ privateJwk })

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

  describe('P-256 keys', () => {
    it('should create, update and deactivate a did:cheqd using a P-256 key created by the registrar', async () => {
      const createResult = await agent.dids.create<CheqdDidCreateOptions>({
        method: 'cheqd',
        options: {
          createKey: { type: { kty: 'EC', crv: 'P-256' } },
          network: 'testnet',
        },
      })
      expect(createResult).toMatchObject({
        didState: {
          state: 'finished',
          didDocument: {
            verificationMethod: [{ type: 'JsonWebKey2020', publicKeyJwk: { kty: 'EC', crv: 'P-256' } }],
          },
        },
      })
      const did = createResult.didState.did as string
      const didDocument = createResult.didState.didDocument as DidDocument

      const resolved = await agent.dids.resolve(did)
      expect(resolved.didDocument?.verificationMethod?.[0]).toMatchObject({
        type: 'JsonWebKey2020',
        publicKeyJwk: { kty: 'EC', crv: 'P-256' },
      })

      // Updating signs again with the P-256 key (DER-encoded ECDSA)
      didDocument.service = [validService(did)]
      const updateResult = await agent.dids.update<CheqdDidUpdateOptions>({ did, didDocument, options: {} })
      expect(updateResult.didState.state).toBe('finished')

      const deactivateResult = await agent.dids.deactivate({ did })
      expect(deactivateResult.didState.state).toBe('finished')
    })

    it('should create a did:cheqd using an existing P-256 kms key', async () => {
      const key = await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
      const result = await agent.dids.create<CheqdDidCreateOptions>({
        method: 'cheqd',
        options: { keyId: key.keyId, network: 'testnet' },
      })
      expect(result.didState.state).toBe('finished')
    })

    it('should add a P-256 key as verification method when updating', async () => {
      const createResult = await agent.dids.create<CheqdDidCreateOptions>({
        method: 'cheqd',
        options: { createKey: { type: { kty: 'EC', crv: 'P-256' } }, network: 'testnet' },
      })
      const did = createResult.didState.did as string
      const didDocument = createResult.didState.didDocument as DidDocument

      const updateResult = await agent.dids.update<CheqdDidUpdateOptions>({
        did,
        didDocument,
        options: { createKey: { type: { kty: 'EC', crv: 'P-256' } } },
      })
      expect(updateResult.didState.state).toBe('finished')
      expect(updateResult.didState.didDocument?.verificationMethod).toHaveLength(2)
    })

    it('should fail for base58btc identifiers with a P-256 key', async () => {
      const result = await agent.dids.create<CheqdDidCreateOptions>({
        method: 'cheqd',
        options: {
          createKey: { type: { kty: 'EC', crv: 'P-256' } },
          network: 'testnet',
          methodSpecificIdAlgo: 'base58btc',
        },
      })
      expect(result.didState).toMatchObject({ state: 'failed' })
    })

    it('should fail for an existing kms key with an unsupported curve', async () => {
      const key = await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-384' } })
      const result = await agent.dids.create<CheqdDidCreateOptions>({
        method: 'cheqd',
        options: { keyId: key.keyId, network: 'testnet' },
      })
      expect(result.didState).toMatchObject({ state: 'failed' })
    })
  })

  describe('updating a did', () => {
    // Same payer as the rest of this file, so the writes run in order and cannot race on the account sequence
    const rotateTo = async (did: string, keys?: boolean) => {
      const newKey = await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
      const newKeyUrl = `${did}#key-2`
      const rotated = new DidDocumentBuilder(did)
        .addContext('https://w3id.org/security/suites/jws-2020/v1')
        .addVerificationMethod(
          getJsonWebKey2020({
            did,
            publicJwk: Kms.PublicJwk.fromPublicJwk(newKey.publicJwk),
            verificationMethodId: newKeyUrl,
          })
        )
        .addAuthentication(newKeyUrl)
        .addAssertionMethod(newKeyUrl)
        .build()
      const update = await agent.dids.update<CheqdDidUpdateOptions>({
        did,
        didDocument: rotated,
        options: keys === false ? {} : { keys: [{ didDocumentRelativeKeyId: '#key-2', kmsKeyId: newKey.keyId }] },
      })
      return { update, newKeyUrl }
    }

    it('rotates the authentication key of a did to a new P-256 key and signs a further update with it', async () => {
      const created = await agent.dids.create<CheqdDidCreateOptions>({
        method: 'cheqd',
        options: { createKey: { type: { kty: 'EC', crv: 'P-256' } }, network: 'testnet' },
      })
      const did = created.didState.did as string
      const oldJwk = (created.didState.didDocument as DidDocument).verificationMethod?.[0].publicKeyJwk

      const { update, newKeyUrl } = await rotateTo(did)
      expect(update.didState, JSON.stringify(update.didState)).toMatchObject({ state: 'finished' })

      const resolved = await agent.dids.resolve(did)
      const methods = resolved.didDocument?.verificationMethod ?? []
      expect(methods).toHaveLength(1)
      expect(methods[0].id).toBe(newKeyUrl)
      expect(methods[0].publicKeyJwk).not.toEqual(oldJwk)

      const second = await agent.dids.update<CheqdDidUpdateOptions>({
        did,
        didDocument: resolved.didDocument as DidDocument,
        options: {},
      })
      expect(second.didState).toMatchObject({ state: 'finished' })
    })

    // A did created by one agent can be taken over by another that is given the private key: the key goes into the kms of
    // the second agent, and the did is imported with it.
    it('lets another agent that imports the did and its key update it', async () => {
      const { privateKey } = generateKeyPairSync('ed25519')
      const jwk = privateKey.export({ format: 'jwk' }) as Kms.KmsJwkPrivateOkp
      const publicJwk = Kms.PublicJwk.fromPublicJwk({ kty: 'OKP', crv: 'Ed25519', x: jwk.x })
      const privateJwk = { ...jwk, kid: publicJwk.legacyKeyId } as Kms.KmsJwkPrivate

      await agent.kms.importKey({ privateJwk })
      const created = await agent.dids.create<CheqdDidCreateOptions>({
        method: 'cheqd',
        options: { keyId: publicJwk.legacyKeyId, network: 'testnet' },
      })
      expect(created.didState.state).toBe('finished')
      const did = created.didState.did as string

      const importer = new Agent(getAgentOptions('Did importer', {}, {}, getCheqdModules(cheqdPayerSeeds[0])))
      await importer.initialize()
      try {
        await importer.kms.importKey({ privateJwk })
        await importer.dids.import({
          did,
          keys: [{ didDocumentRelativeKeyId: '#key-1', kmsKeyId: publicJwk.legacyKeyId }],
        })

        const document = (await importer.dids.resolve(did)).didDocument as DidDocument
        document.service = [validService(did)]
        const updated = await importer.dids.update<CheqdDidUpdateOptions>({ did, didDocument: document, options: {} })
        expect(updated.didState, JSON.stringify(updated.didState)).toMatchObject({ state: 'finished' })
      } finally {
        await importer.shutdown()
      }
    })

    it('cannot update a did it has no key for', async () => {
      const created = await agent.dids.create<CheqdDidCreateOptions>({
        method: 'cheqd',
        options: { createKey: { type: { kty: 'OKP', crv: 'Ed25519' } }, network: 'testnet' },
      })
      const did = created.didState.did as string

      const stranger = new Agent(getAgentOptions('Did stranger', {}, {}, getCheqdModules(cheqdPayerSeeds[0])))
      await stranger.initialize()
      try {
        await stranger.dids.import({ did })
        const document = (await stranger.dids.resolve(did)).didDocument as DidDocument
        document.service = [validService(did)]
        const updated = await stranger.dids.update<CheqdDidUpdateOptions>({ did, didDocument: document, options: {} })
        expect(updated.didState.state).toBe('failed')
      } finally {
        await stranger.shutdown()
      }
    })

    // Dids created by older versions use an Ed25519VerificationKey2018 method named by the key fingerprint, a key
    // stored under its legacy key id (the fingerprint), and a did record without key mappings.
    describe('created the way older versions did', () => {
      const createLegacyDid = async () => {
        const { privateKey } = generateKeyPairSync('ed25519')
        const jwk = privateKey.export({ format: 'jwk' }) as Kms.KmsJwkPrivateOkp
        const publicJwk = Kms.PublicJwk.fromPublicJwk({ kty: 'OKP', crv: 'Ed25519', x: jwk.x })
        await agent.kms.importKey({ privateJwk: { ...jwk, kid: publicJwk.legacyKeyId } as Kms.KmsJwkPrivate })

        const did = `did:cheqd:testnet:${utils.uuid()}`
        const keyUrl = `${did}#${publicJwk.fingerprint}`
        const created = await agent.dids.create<CheqdDidCreateOptions>({
          method: 'cheqd',
          didDocument: new DidDocumentBuilder(did)
            .addController(did)
            .addAuthentication(keyUrl)
            .addVerificationMethod(getEd25519VerificationKey2018({ publicJwk, controller: did, id: keyUrl }))
            .build(),
          options: {
            keys: [{ didDocumentRelativeKeyId: `#${publicJwk.fingerprint}`, kmsKeyId: publicJwk.legacyKeyId }],
          },
        })
        expect(created.didState.state).toBe('finished')

        // An older did record has no key mappings
        const repository = agent.dependencyManager.resolve(DidRepository)
        const record = await repository.findCreatedDid(agent.context, did)
        if (!record) throw new Error('did record not found')
        record.keys = undefined
        await repository.update(agent.context, record)

        return { did, keyUrl, document: created.didState.didDocument as DidDocument }
      }

      it('updates the did, signing with the key found by its legacy key id', async () => {
        const { did, document } = await createLegacyDid()

        document.service = [validService(did)]
        const update = await agent.dids.update<CheqdDidUpdateOptions>({ did, didDocument: document, options: {} })
        expect(update.didState, JSON.stringify(update.didState)).toMatchObject({ state: 'finished' })
      })

      it('rotates the authentication key of the did', async () => {
        const { did, keyUrl } = await createLegacyDid()

        const { update, newKeyUrl } = await rotateTo(did)
        expect(update.didState, JSON.stringify(update.didState)).toMatchObject({ state: 'finished' })

        const resolved = await agent.dids.resolve(did)
        const ids = resolved.didDocument?.verificationMethod?.map((method) => method.id)
        expect(ids).toEqual([newKeyUrl])
        expect(ids).not.toContain(keyUrl)
      })
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

  describe('createResource with string data', () => {
    // Bytes that encode with '+' and '/' in base64 and with '-' and '_' in base64url
    const bytes = new Uint8Array([0xfb, 0xff, 0xbe, 0xfb, 0xef])

    it.each([
      ['standard base64', TypedArrayEncoder.toBase64(bytes)],
      ['base64url without padding', TypedArrayEncoder.toBase64Url(bytes)],
    ])('writes a resource whose data is %s', async (_name, data) => {
      // Same payer as the rest of this file, so the writes run in order and cannot race on the account sequence
      const didResult = await agent.dids.create<CheqdDidCreateOptions>({
        method: 'cheqd',
        options: {
          createKey: { type: { kty: 'OKP', crv: 'Ed25519' } },
          network: 'testnet',
          methodSpecificIdAlgo: 'uuid',
        },
      })
      if (!didResult.didState.did) throw new Error('No DID created')

      const registrar = agent.dependencyManager.resolve(CheqdDidRegistrar)
      const result = await registrar.createResource(agent.context, didResult.didState.did, {
        id: utils.uuid(),
        name: 'BinaryResource',
        resourceType: 'test',
        data,
        version: '1',
      })

      expect(result.resourceState).toMatchObject({ state: 'finished' })
    })
  })

  describe('createResource with Uint8Array and object data', () => {
    const create = async (data: Uint8Array | object) => {
      const didResult = await agent.dids.create<CheqdDidCreateOptions>({
        method: 'cheqd',
        options: {
          createKey: { type: { kty: 'OKP', crv: 'Ed25519' } },
          network: 'testnet',
          methodSpecificIdAlgo: 'uuid',
        },
      })
      if (!didResult.didState.did) throw new Error('No DID created')
      const did = didResult.didState.did

      const id = utils.uuid()
      const registrar = agent.dependencyManager.resolve(CheqdDidRegistrar)
      const result = await registrar.createResource(agent.context, did, {
        id,
        name: 'BytesResource',
        resourceType: 'test',
        data,
        version: '1',
      })
      expect(result.resourceState).toMatchObject({ state: 'finished' })

      const ledger = agent.dependencyManager.resolve(CheqdLedgerService)
      const stored = await ledger.resolveResource(did, did.split(':')[3], id)
      return stored.resource?.data
    }

    it('stores Uint8Array data as the same bytes', async () => {
      const bytes = TypedArrayEncoder.fromUtf8String('header.payload.signature')
      expect(await create(bytes)).toEqual(bytes)
    })

    it('stores object data as JSON', async () => {
      const stored = await create({ hello: 'world' })
      expect(TypedArrayEncoder.toUtf8String(stored as Uint8Array)).toBe('{"hello":"world"}')
    })
  })
})

describe('Agent card signed by a P-256 did:cheqd', () => {
  // The verifier holds no record of the did, so it has to resolve it from the ledger
  const verifier = new Agent(getAgentOptions('Agent card verifier', {}, {}, getCheqdModules(cheqdPayerSeeds[0])))
  const signer = new Agent(getAgentOptions('Agent card signer', {}, {}, getCheqdModules(cheqdPayerSeeds[0])))

  beforeAll(async () => {
    await Promise.all([signer.initialize(), verifier.initialize()])
  })

  afterAll(async () => {
    await Promise.all([signer.shutdown(), verifier.shutdown()])
  })

  it('is verified by a separate agent and by the official A2A SDK through the ledger', async () => {
    const created = await signer.dids.create<CheqdDidCreateOptions>({
      method: 'cheqd',
      options: { createKey: { type: { kty: 'EC', crv: 'P-256' } }, network: 'testnet' },
    })
    expect(created.didState.state).toBe('finished')
    const didUrl = `${created.didState.did}#key-1`

    const card = AgentCard.fromJSON({
      name: 'Agent with a did:cheqd identity',
      description: 'Signed with a P-256 key of its DID',
      supportedInterfaces: [
        { url: 'https://agent.example.com/a2a', protocolBinding: 'JSONRPC', protocolVersion: '1.0' },
      ],
      version: '1.0.0',
      capabilities: {},
      defaultInputModes: ['text/plain'],
      defaultOutputModes: ['text/plain'],
      skills: [],
    })
    const payload = canonicalizeAgentCard(card)
    const signature = await signAgentCardPayload(signer.context, { didUrl, payload })
    card.signatures = [{ ...signature, header: {} }]

    expect(await verifyAgentCardSignature(verifier.context, { payload, signature })).toEqual({ isValid: true, didUrl })

    await expect(
      verifyWithA2aSdk(async (kid) => {
        const { didDocument } = await verifier.dids.resolve(kid.split('#')[0])
        if (!didDocument) throw new Error(`could not resolve ${kid}`)
        return getPublicJwkFromVerificationMethod(didDocument.dereferenceKey(kid, ['authentication'])).toJson()
      })(card)
    ).resolves.toBeUndefined()

    const tampered = await verifyAgentCardSignature(verifier.context, { payload: `${payload} `, signature })
    expect(tampered.isValid).toBe(false)
  })
})
