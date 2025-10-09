import {
  Agent,
  ConsoleLogger,
  DidDocument,
  type DidDocumentKey,
  DidDocumentService,
  Kms,
  LogLevel,
  VerificationMethod,
} from '@credo-ts/core'
import type { HederaDidCreateOptions, HederaDidUpdateOptions } from '../../src'
import { getMultibasePublicKey } from '../../src/ledger/utils'
import { getHederaAgent } from './utils'

const validDid = 'did:hedera:testnet:44eesExqdsUvLZ35FpnBPErqRGRnYbzzyG3wgCCYxkmq_0.0.6226170'

const validService = new DidDocumentService({
  id: '#service-1',
  type: 'CustomType',
  serviceEndpoint: ['https://rand.io'],
})

function getValidVerificationMethod(publicKeyMultibase?: string) {
  return new VerificationMethod({
    id: '#key-1',
    type: 'Ed25519VerificationKey2020',
    controller: validDid,
    publicKeyMultibase: publicKeyMultibase ?? 'z44eesExqdsUvLZ35FpnBPErqRGRnYbzzyG3wgCCYxkmq',
  })
}

function getValidDidDocument(publicKeyMultibase?: string) {
  return new DidDocument({
    id: validDid,
    verificationMethod: [getValidVerificationMethod(publicKeyMultibase)],
    service: [validService],
  })
}

describe('Hedera DID registrar', () => {
  const logger = new ConsoleLogger(LogLevel.error)
  let agent: Agent

  beforeAll(async () => {
    agent = getHederaAgent({
      logger,
      label: 'alice',
    })
    await agent.initialize()
  })

  afterAll(async () => {
    await agent.shutdown()
  })

  it('should create a did:hedera did document', async () => {
    const didResult = await agent.dids.create<HederaDidCreateOptions>({
      method: 'hedera',
      options: { network: 'testnet' },
    })

    expect(didResult).toMatchObject({
      didState: {
        state: 'finished',
        didDocument: {
          verificationMethod: [
            {
              type: 'Ed25519VerificationKey2020',
              publicKeyMultibase: expect.any(String),
            },
          ],
        },
      },
    })
  })

  it('should create a did:hedera did document with document presets', async () => {
    const { keyId, publicJwk } = await agent.kms.createKey({
      type: {
        crv: 'Ed25519',
        kty: 'OKP',
      },
    })
    const multibasePublicKey = getMultibasePublicKey(Kms.PublicJwk.fromPublicJwk(publicJwk))
    const keys: DidDocumentKey[] = [
      {
        kmsKeyId: keyId,
        didDocumentRelativeKeyId: '#key-1',
      },
    ]

    const didResult = await agent.dids.create<HederaDidCreateOptions>({
      method: 'hedera',
      didDocument: getValidDidDocument(multibasePublicKey),
      options: { network: 'testnet' },
      secret: { keys },
    })
    expect(didResult.didState.state).toEqual('finished')

    const verificationMethod = getValidVerificationMethod(multibasePublicKey)
    expect(didResult.didState.didDocument?.verificationMethod).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.stringContaining('#did-root-key'),
          type: expect.any(String),
          controller: didResult.didState.didDocument?.id,
          publicKeyMultibase: expect.any(String),
        }),
        expect.objectContaining({
          id: expect.stringContaining(verificationMethod.id),
          type: verificationMethod.type,
          controller: verificationMethod.controller,
          publicKeyMultibase: verificationMethod.publicKeyMultibase,
        }),
      ])
    )

    expect(didResult.didState.didDocument?.service).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.stringContaining(validService.id),
          type: validService.type,
          serviceEndpoint: validService.serviceEndpoint,
        }),
      ])
    )
  })

  it('should create a did:hedera did document, add and remove service', async () => {
    const didResult = await agent.dids.create<HederaDidCreateOptions>({
      method: 'hedera',
      options: {
        network: 'testnet',
      },
    })
    expect(didResult).toMatchObject({ didState: { state: 'finished' } })

    const did = didResult.didState.did ?? ''
    const didDocument = didResult.didState.didDocument as DidDocument
    didDocument.service = [validService]

    const addUpdateResult = await agent.dids.update<HederaDidUpdateOptions>({
      did,
      didDocument,
      didDocumentOperation: 'addToDidDocument',
    })

    expect(addUpdateResult.didState.state).toEqual('finished')
    expect(addUpdateResult.didState.didDocument?.id).toEqual(did)

    const resolvedDocument = await agent.dids.resolve(did, {
      useLocalCreatedDidRecord: false,
    })
    expect(resolvedDocument.didDocument?.id).toEqual(did)

    expect(resolvedDocument.didDocument?.service).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.stringContaining(validService.id),
          type: validService.type,
          serviceEndpoint: validService.serviceEndpoint,
        }),
      ])
    )

    const removeUpdateResult = await agent.dids.update<HederaDidUpdateOptions>({
      did,
      didDocument: {
        ...didDocument,
        verificationMethod: undefined,
      },
      didDocumentOperation: 'removeFromDidDocument',
    })

    expect(removeUpdateResult.didState.state).toEqual('finished')
    expect(removeUpdateResult.didState.didDocument?.id).toEqual(did)

    const removeResolvedDocument = await agent.dids.resolve(did, {
      useLocalCreatedDidRecord: false,
    })
    expect(removeResolvedDocument.didDocument?.id).toEqual(did)
    expect(removeResolvedDocument.didDocument?.service ?? []).toHaveLength(0)
  })

  it('should create a did:hedera did document, add and remove verification method', async () => {
    const { keyId, publicJwk } = await agent.kms.createKey({
      type: {
        crv: 'Ed25519',
        kty: 'OKP',
      },
    })
    const multibasePublicKey = getMultibasePublicKey(Kms.PublicJwk.fromPublicJwk(publicJwk))
    const didDocumentKey = {
      kmsKeyId: keyId,
      didDocumentRelativeKeyId: '#key-1',
    }
    const keys: DidDocumentKey[] = [didDocumentKey]

    const didResult = await agent.dids.create<HederaDidCreateOptions>({
      method: 'hedera',
      options: { network: 'testnet' },
    })
    expect(didResult).toMatchObject({ didState: { state: 'finished' } })

    const did = didResult.didState.did ?? ''
    const didDocument = didResult.didState.didDocument as DidDocument

    const validVerificationMethod = getValidVerificationMethod(multibasePublicKey)
    didDocument.verificationMethod = [validVerificationMethod]

    const addUpdateResult = await agent.dids.update<HederaDidUpdateOptions>({
      did,
      didDocument,
      didDocumentOperation: 'addToDidDocument',
      secret: {
        keys,
      },
    })
    expect(addUpdateResult.didState.didDocument?.id).toEqual(did)
    expect(addUpdateResult.didState.state).toEqual('finished')

    const addResolvedDocument = await agent.dids.resolve(did, {
      useLocalCreatedDidRecord: false,
    })

    expect(addResolvedDocument.didDocument?.id).toEqual(did)
    expect(addResolvedDocument.didDocument?.verificationMethod).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.stringContaining(validVerificationMethod.id),
          type: validVerificationMethod.type,
          controller: validVerificationMethod.controller,
          publicKeyMultibase: validVerificationMethod.publicKeyMultibase,
        }),
      ])
    )

    // Check that added verification method key is referenced in DID record
    let didRecords = await agent.dids.getCreatedDids({ method: 'hedera', did })
    expect(didRecords).toHaveLength(1)
    expect(didRecords[0].keys).toContainEqual(didDocumentKey)

    const removeUpdateResult = await agent.dids.update<HederaDidUpdateOptions>({
      did,
      didDocument,
      didDocumentOperation: 'removeFromDidDocument',
      secret: {
        keys,
      },
    })
    expect(removeUpdateResult.didState.didDocument?.id).toEqual(did)
    expect(removeUpdateResult.didState.state).toEqual('finished')

    const removeResolvedDocument = await agent.dids.resolve(did, {
      useLocalCreatedDidRecord: false,
    })

    expect(removeResolvedDocument.didDocument?.id).toEqual(did)
    expect(removeResolvedDocument.didDocument?.verificationMethod ?? []).toHaveLength(1)
    expect(removeResolvedDocument.didDocument?.verificationMethod).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({
          id: expect.stringContaining(validVerificationMethod.id),
          type: validVerificationMethod.type,
          controller: validVerificationMethod.controller,
          publicKeyMultibase: validVerificationMethod.publicKeyMultibase,
        }),
      ])
    )

    // Check that removed verification method key is not referenced in DID record
    didRecords = await agent.dids.getCreatedDids({ method: 'hedera', did })
    expect(didRecords).toHaveLength(1)
    expect(didRecords[0].keys).not.toContainEqual(didDocumentKey)
  })

  it('should create a did:hedera did document, but should not add verification method without required keys', async () => {
    const { publicJwk } = await agent.kms.createKey({
      type: {
        crv: 'Ed25519',
        kty: 'OKP',
      },
    })
    const multibasePublicKey = getMultibasePublicKey(Kms.PublicJwk.fromPublicJwk(publicJwk))

    const didResult = await agent.dids.create<HederaDidCreateOptions>({
      method: 'hedera',
      options: { network: 'testnet' },
    })
    expect(didResult).toMatchObject({ didState: { state: 'finished' } })

    const did = didResult.didState.did ?? ''
    const didDocument = didResult.didState.didDocument as DidDocument

    const validVerificationMethod = getValidVerificationMethod(multibasePublicKey)
    didDocument.verificationMethod = [validVerificationMethod]

    const expectedFailureReason =
      'Unable update DID: Key #key-1 is present in updated DID Document, but missing from DID record keys and DID update arguments'

    let updateResult = await agent.dids.update<HederaDidUpdateOptions>({
      did,
      didDocument,
      didDocumentOperation: 'addToDidDocument',
    })
    expect(updateResult.didState.state).toEqual('failed')
    if (updateResult.didState.state === 'failed') expect(updateResult.didState.reason).toEqual(expectedFailureReason)

    didDocument.verificationMethod = undefined
    didDocument.assertionMethod = [validVerificationMethod]

    updateResult = await agent.dids.update<HederaDidUpdateOptions>({
      did,
      didDocument,
      didDocumentOperation: 'addToDidDocument',
    })
    expect(updateResult.didState.state).toEqual('failed')
    if (updateResult.didState.state === 'failed') expect(updateResult.didState.reason).toEqual(expectedFailureReason)

    didDocument.assertionMethod = undefined
    didDocument.authentication = [validVerificationMethod]

    updateResult = await agent.dids.update<HederaDidUpdateOptions>({
      did,
      didDocument,
      didDocumentOperation: 'addToDidDocument',
    })
    expect(updateResult.didState.state).toEqual('failed')
    if (updateResult.didState.state === 'failed') expect(updateResult.didState.reason).toEqual(expectedFailureReason)

    didDocument.authentication = undefined
    didDocument.capabilityDelegation = [validVerificationMethod]

    updateResult = await agent.dids.update<HederaDidUpdateOptions>({
      did,
      didDocument,
      didDocumentOperation: 'addToDidDocument',
    })
    expect(updateResult.didState.state).toEqual('failed')
    if (updateResult.didState.state === 'failed') expect(updateResult.didState.reason).toEqual(expectedFailureReason)

    didDocument.capabilityDelegation = undefined
    didDocument.capabilityInvocation = [validVerificationMethod]

    updateResult = await agent.dids.update<HederaDidUpdateOptions>({
      did,
      didDocument,
      didDocumentOperation: 'addToDidDocument',
    })
    expect(updateResult.didState.state).toEqual('failed')
    if (updateResult.didState.state === 'failed') expect(updateResult.didState.reason).toEqual(expectedFailureReason)

    didDocument.capabilityInvocation = undefined
    didDocument.keyAgreement = [validVerificationMethod]

    updateResult = await agent.dids.update<HederaDidUpdateOptions>({
      did,
      didDocument,
      didDocumentOperation: 'addToDidDocument',
    })
    expect(updateResult.didState.state).toEqual('failed')
    if (updateResult.didState.state === 'failed') expect(updateResult.didState.reason).toEqual(expectedFailureReason)
  })

  it('should create and deactivate a did:hedera did', async () => {
    const didResult = await agent.dids.create<HederaDidCreateOptions>({
      method: 'hedera',
      options: {
        network: 'testnet',
      },
    })
    expect(didResult).toMatchObject({ didState: { state: 'finished' } })

    const did = didResult.didState.did ?? ''

    const deactivateResult = await agent.dids.deactivate({
      did,
    })

    expect(deactivateResult.didState.didDocument?.id).toEqual(did)
    expect(deactivateResult.didState.state).toEqual('finished')

    const resolvedDocument = await agent.dids.resolve(did, {
      useLocalCreatedDidRecord: false,
    })
    expect(resolvedDocument.didDocumentMetadata.deactivated).toBe(true)
  })
})
