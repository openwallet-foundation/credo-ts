/**
 * Regression tests for the verification method that attested resources are signed with.
 *
 * Attested resource proofs use the `assertionMethod` proof purpose, and the core
 * `W3cDataIntegrityApi` enforces that the proof's verification method is authorized for that
 * verification relationship. Selecting `verificationMethod[0]` therefore produces resources that
 * are written successfully and then fail to resolve whenever the first verification method is not
 * referenced from `assertionMethod` — which is the case for a did:webvh whose log-control
 * (update) key is separate from its signing key.
 *
 * Unlike the other tests in this directory these run against real Ed25519 keys and the real
 * `W3cDataIntegrityApi`, so a resource actually has to round-trip. No network access is needed:
 * DID resolution is stubbed from the repository for relationship-selection tests; a separate
 * test below resolves a real registrar-authored log.
 */

import {
  CacheModuleConfig,
  DependencyManager,
  DidDocument,
  DidDocumentRole,
  DidRecord,
  DidRepository,
  DidsModuleConfig,
  InjectionSymbols,
  InMemoryLruCache,
  Kms,
  type Proof,
  VerificationMethod,
  W3cDataIntegrityModule,
} from '@credo-ts/core'
import type { DIDLog } from 'didwebvh-ts'
import { Subject } from 'rxjs'

import { InMemoryStorageService } from '../../../../../../tests/InMemoryStorageService'
import { agentDependencies, getAgentConfig, getAgentContext } from '../../../../../core/tests/helpers'
import { createWebVhTestOptions } from '../../../../tests/utils'
import { WebVhDidRegistrar } from '../../../dids/WebVhDidRegistrar'
import { WebVhDidResolver } from '../../../dids/WebVhDidResolver'
import { WebVhDidRecordMetadataKeys } from '../../../dids/webVhDidRecordMetadataTypes'
import { WebVhAnonCredsRegistry } from '../WebVhAnonCredsRegistry'

const issuerId = 'did:webvh:QmXysm9EF3kPH4fdCWf48YqCzREgiAe5nFXG3RCXaCShFX:id.test-suite.app:credo:01'

describe('WebVhAnonCredsRegistry assertionMethod signing', () => {
  let agentContext: ReturnType<typeof getAgentContext>
  let registry: WebVhAnonCredsRegistry
  let resolveResource: ReturnType<typeof vi.spyOn>
  let updateVerificationMethodId: string
  let assertionVerificationMethodId: string

  const schema = { issuerId, attrNames: ['firstName', 'lastName'], name: 'CredoTest', version: '1.0' }

  beforeEach(async () => {
    const webvhResolver = new WebVhDidResolver()
    resolveResource = vi.spyOn(webvhResolver, 'resolveResource')

    const agentConfig = getAgentConfig('WebVhAnonCredsRegistrySigningTest')
    const dependencyManager = new DependencyManager()
    agentContext = getAgentContext({
      dependencyManager,
      agentConfig,
      registerInstances: [
        [InjectionSymbols.Stop$, new Subject<boolean>()],
        [InjectionSymbols.AgentDependencies, agentDependencies],
        [InjectionSymbols.StorageService, new InMemoryStorageService()],
        [InjectionSymbols.Logger, agentConfig.logger],
        [CacheModuleConfig, new CacheModuleConfig({ cache: new InMemoryLruCache({ limit: 500 }) })],
        [DidsModuleConfig, new DidsModuleConfig({ resolvers: [webvhResolver] })],
      ],
    })
    // Registers the cryptosuite token that W3cDataIntegrityCryptosuiteRegistry injects
    new W3cDataIntegrityModule().register(dependencyManager)

    const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
    const updateKey = await kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
    const assertionKey = await kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
    const updateKeyMultibase = Kms.PublicJwk.fromPublicJwk(updateKey.publicJwk).fingerprint
    const assertionKeyMultibase = Kms.PublicJwk.fromPublicJwk(assertionKey.publicJwk).fingerprint

    updateVerificationMethodId = `${issuerId}#${updateKeyMultibase.slice(-8)}`
    assertionVerificationMethodId = `${issuerId}#${assertionKeyMultibase.slice(-8)}`

    // The update key controls the did log and is deliberately NOT referenced from assertionMethod,
    // while remaining first in verificationMethod so the registrar keeps signing log entries with it
    const didDocument = new DidDocument({
      context: ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/multikey/v1'],
      id: issuerId,
      controller: issuerId,
      verificationMethod: [
        new VerificationMethod({
          id: updateVerificationMethodId,
          type: 'Multikey',
          controller: issuerId,
          publicKeyMultibase: updateKeyMultibase,
        }),
        new VerificationMethod({
          id: assertionVerificationMethodId,
          type: 'Multikey',
          controller: issuerId,
          publicKeyMultibase: assertionKeyMultibase,
        }),
      ],
      authentication: [updateVerificationMethodId],
      assertionMethod: [assertionVerificationMethodId],
    })

    await agentContext.dependencyManager.resolve(DidRepository).save(
      agentContext,
      new DidRecord({
        did: issuerId,
        role: DidDocumentRole.Created,
        didDocument,
        keys: [
          { kmsKeyId: updateKey.keyId, didDocumentRelativeKeyId: `#${updateKeyMultibase.slice(-8)}` },
          { kmsKeyId: assertionKey.keyId, didDocumentRelativeKeyId: `#${assertionKeyMultibase.slice(-8)}` },
        ],
      })
    )

    vi.spyOn(webvhResolver, 'resolve').mockImplementation(async (context, did) => {
      const record = await context.resolve(DidRepository).getSingleByQuery(context, { did })
      return { didDocument: record.didDocument ?? null, didDocumentMetadata: {}, didResolutionMetadata: {} }
    })

    registry = new WebVhAnonCredsRegistry()
  })

  it('round-trips an attested resource using caller-authored fragments and a validated registrar log', async () => {
    const resolver = agentContext.resolve(DidsModuleConfig).resolvers[0] as WebVhDidResolver
    vi.mocked(resolver.resolve).mockRestore()
    const created = await new WebVhDidRegistrar().create(
      agentContext,
      await createWebVhTestOptions(agentContext, 'authored.example.com')
    )
    if (created.didState.state !== 'finished') throw new Error(`Create failed: ${JSON.stringify(created.didState)}`)
    const record = await agentContext.resolve(DidRepository).getSingleByQuery(agentContext, {
      did: created.didState.did,
    })
    const log = record.metadata.get<DIDLog>(WebVhDidRecordMetadataKeys.DidLog)
    if (!log) throw new Error('Created DID has no log')
    vi.spyOn(agentContext.config, 'fetch').mockImplementation(
      async () => new Response(log.map((entry) => JSON.stringify(entry)).join('\n'))
    )
    const authoredSchema = { ...schema, issuerId: created.didState.did }
    const { registrationMetadata, schemaState } = await registry.registerSchema(agentContext, {
      schema: authoredSchema,
    })
    if (schemaState.state !== 'finished') throw new Error('Schema registration failed')
    const resource = JSON.parse(JSON.stringify(registrationMetadata.attestedResource))
    expect(resource.proof.verificationMethod).toBe(`${created.didState.did}#assertion-key`)
    resolveResource.mockResolvedValue({ content: resource, dereferencingMetadata: { contentType: 'application/json' } })
    const result = await registry.getSchema(agentContext, schemaState.schemaId)
    expect(result.resolutionMetadata.error).toBeUndefined()
    expect(result.schema).toEqual(authoredSchema)
  })

  it('signs with the assertionMethod key and the resource round-trips through getSchema', async () => {
    const { registrationMetadata, schemaState } = await registry.registerSchema(agentContext, { schema })

    const attestedResource = JSON.parse(JSON.stringify(registrationMetadata.attestedResource))
    expect(attestedResource.proof.proofPurpose).toBe('assertionMethod')
    expect(attestedResource.proof.verificationMethod).toBe(assertionVerificationMethodId)
    expect(attestedResource.proof.verificationMethod).not.toBe(updateVerificationMethodId)

    if (schemaState.state !== 'finished') throw new Error(`registerSchema did not finish: ${schemaState.state}`)
    const { schemaId } = schemaState

    resolveResource.mockResolvedValue({
      content: attestedResource,
      dereferencingMetadata: { contentType: 'application/json' },
    })

    const schemaResponse = await registry.getSchema(agentContext, schemaId)

    expect(resolveResource).toHaveBeenCalledWith(agentContext, schemaId)
    expect(schemaResponse.resolutionMetadata.error).toBeUndefined()
    expect(schemaResponse.schema).toEqual(schema)
  })

  it('rejects an explicit verification method that is not authorized for assertionMethod', async () => {
    await expect(
      registry.registerSchema(agentContext, {
        schema,
        options: { verificationMethod: updateVerificationMethodId },
      })
    ).rejects.toThrow(
      `Verification method '${updateVerificationMethodId}' is not authorized for 'assertionMethod' in the did document of issuer ${issuerId}`
    )
  })

  it('throws when the did document has no verification method authorized for assertionMethod', async () => {
    const didRepository = agentContext.dependencyManager.resolve(DidRepository)
    const didRecord = await didRepository.getSingleByQuery(agentContext, { did: issuerId })
    const didDocument = didRecord.didDocument
    if (!didDocument) throw new Error('did record has no did document')
    didDocument.assertionMethod = []
    await didRepository.update(agentContext, didRecord)

    await expect(registry.registerSchema(agentContext, { schema })).rejects.toThrow(
      `No Ed25519 verification method authorized for 'assertionMethod' found in the did document of issuer ${issuerId}`
    )
  })

  it('does not verify a resource signed with a verification method outside assertionMethod', async () => {
    const unsecuredDocument = {
      '@context': [
        'https://identity.foundation/did-attested-resources/context/v0.1',
        'https://w3id.org/security/data-integrity/v2',
      ],
      type: ['AttestedResource'],
      id: `${issuerId}/resources/zQmSmhgCkiknv5HpLWiiNjgcurgQvwhUqiu8MSGMDVJt3xK`,
      content: schema,
      metadata: { resourceType: 'anonCredsSchema', resourceName: schema.name },
    }

    // Signing succeeds, as the agent holds the update key, but the proof is not verifiable
    const proof = await registry.createProof(agentContext, unsecuredDocument, updateVerificationMethodId)

    await expect(
      registry.verifyProof(agentContext, JSON.parse(JSON.stringify({ ...unsecuredDocument, proof })))
    ).resolves.toBe(false)
  })

  it('re-signs an updated revocation registry definition with an authorized verification method', async () => {
    const metadata = { resourceType: 'anonCredsRevocRegDef', resourceName: 'default' }

    // A resource first signed with the unauthorized update key is healed on update
    const previousProof = await registry.createProof(agentContext, metadata, updateVerificationMethodId)
    // updateRevocationRegistryDefinition declares its metadata as Record<string, object> and its
    // proof as the legacy linked-data Proof, neither of which describes an attested resource or
    // the proof createProof returns, so realistic input only reaches it through a cast.
    const previousMetadata = { ...metadata, proof: previousProof } as unknown as { proof: Proof } & Record<
      string,
      object
    >
    const { registrationMetadata } = await registry.updateRevocationRegistryDefinition(agentContext, previousMetadata, {
      extra: { updated: true },
    })

    const updated = JSON.parse(JSON.stringify(registrationMetadata))
    expect(updated.proof.verificationMethod).toBe(assertionVerificationMethodId)
    expect(updated.extra).toEqual({ updated: true })
  })

  it('prefers an assertionMethod key the agent holds over one it does not', async () => {
    const didRepository = agentContext.dependencyManager.resolve(DidRepository)
    const didRecord = await didRepository.getSingleByQuery(agentContext, { did: issuerId })
    const didDocument = didRecord.didDocument
    if (!didDocument) throw new Error('did record has no did document')

    // A delegate key the agent has no private key for, listed ahead of the agent's own key
    const foreignVerificationMethodId = `${issuerId}#foreignkey`
    didDocument.verificationMethod = [
      ...(didDocument.verificationMethod ?? []),
      new VerificationMethod({
        id: foreignVerificationMethodId,
        type: 'Multikey',
        controller: issuerId,
        publicKeyMultibase: 'z6MkukEa8GPVCEPy7EzRSbeHPXD1vsuPy3eD13CkDKQsoCGS',
      }),
    ]
    didDocument.assertionMethod = [foreignVerificationMethodId, assertionVerificationMethodId]
    await didRepository.update(agentContext, didRecord)

    const { registrationMetadata } = await registry.registerSchema(agentContext, { schema })

    const attestedResource = JSON.parse(JSON.stringify(registrationMetadata.attestedResource))
    expect(attestedResource.proof.verificationMethod).toBe(assertionVerificationMethodId)
  })

  it('signs with an Ed25519VerificationKey2020 assertionMethod key and the resource round-trips', async () => {
    const didRepository = agentContext.dependencyManager.resolve(DidRepository)
    const didRecord = await didRepository.getSingleByQuery(agentContext, { did: issuerId })
    const didDocument = didRecord.didDocument
    if (!didDocument) throw new Error('did record has no did document')

    didDocument.verificationMethod = (didDocument.verificationMethod ?? []).map((method) =>
      method.id === assertionVerificationMethodId
        ? new VerificationMethod({
            id: method.id,
            type: 'Ed25519VerificationKey2020',
            controller: method.controller,
            publicKeyMultibase: method.publicKeyMultibase,
          })
        : method
    )
    await didRepository.update(agentContext, didRecord)

    const { registrationMetadata, schemaState } = await registry.registerSchema(agentContext, { schema })

    const attestedResource = JSON.parse(JSON.stringify(registrationMetadata.attestedResource))
    expect(attestedResource.proof.verificationMethod).toBe(assertionVerificationMethodId)

    if (schemaState.state !== 'finished') throw new Error(`registerSchema did not finish: ${schemaState.state}`)
    resolveResource.mockResolvedValue({
      content: attestedResource,
      dereferencingMetadata: { contentType: 'application/json' },
    })

    const schemaResponse = await registry.getSchema(agentContext, schemaState.schemaId)

    expect(schemaResponse.resolutionMetadata.error).toBeUndefined()
    expect(schemaResponse.schema).toEqual(schema)
  })

  // eddsa-jcs-2022 can only sign with Ed25519, so a P-256 key in assertionMethod must never be used
  async function addP256AssertionMethodKey() {
    const didRepository = agentContext.dependencyManager.resolve(DidRepository)
    const didRecord = await didRepository.getSingleByQuery(agentContext, { did: issuerId })
    const didDocument = didRecord.didDocument
    if (!didDocument) throw new Error('did record has no did document')

    const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
    const p256Key = await kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
    const p256KeyMultibase = Kms.PublicJwk.fromPublicJwk(p256Key.publicJwk).fingerprint
    const p256VerificationMethodId = `${issuerId}#${p256KeyMultibase.slice(-8)}`

    didDocument.verificationMethod = [
      ...(didDocument.verificationMethod ?? []),
      new VerificationMethod({
        id: p256VerificationMethodId,
        type: 'Multikey',
        controller: issuerId,
        publicKeyMultibase: p256KeyMultibase,
      }),
    ]
    didDocument.assertionMethod = [p256VerificationMethodId, assertionVerificationMethodId]
    didRecord.keys = [
      ...(didRecord.keys ?? []),
      { kmsKeyId: p256Key.keyId, didDocumentRelativeKeyId: `#${p256KeyMultibase.slice(-8)}` },
    ]
    await didRepository.update(agentContext, didRecord)

    return p256VerificationMethodId
  }

  it('skips a P-256 Multikey assertionMethod key listed before the Ed25519 one', async () => {
    await addP256AssertionMethodKey()

    const { registrationMetadata } = await registry.registerSchema(agentContext, { schema })

    const attestedResource = JSON.parse(JSON.stringify(registrationMetadata.attestedResource))
    expect(attestedResource.proof.verificationMethod).toBe(assertionVerificationMethodId)
  })

  it('rejects an explicit P-256 verification method', async () => {
    const p256VerificationMethodId = await addP256AssertionMethodKey()

    await expect(
      registry.registerSchema(agentContext, { schema, options: { verificationMethod: p256VerificationMethodId } })
    ).rejects.toThrow(
      `Verification method '${p256VerificationMethodId}' is not an Ed25519 key, which 'eddsa-jcs-2022' requires`
    )
  })

  it('prefers a Multikey assertionMethod key over an Ed25519VerificationKey2020 one', async () => {
    const didRepository = agentContext.dependencyManager.resolve(DidRepository)
    const didRecord = await didRepository.getSingleByQuery(agentContext, { did: issuerId })
    const didDocument = didRecord.didDocument
    if (!didDocument) throw new Error('did record has no did document')

    didDocument.verificationMethod = (didDocument.verificationMethod ?? []).map((method) =>
      method.id === updateVerificationMethodId
        ? new VerificationMethod({
            id: method.id,
            type: 'Ed25519VerificationKey2020',
            controller: method.controller,
            publicKeyMultibase: method.publicKeyMultibase,
          })
        : method
    )
    didDocument.assertionMethod = [updateVerificationMethodId, assertionVerificationMethodId]
    await didRepository.update(agentContext, didRecord)

    const { registrationMetadata } = await registry.registerSchema(agentContext, { schema })

    const attestedResource = JSON.parse(JSON.stringify(registrationMetadata.attestedResource))
    expect(attestedResource.proof.verificationMethod).toBe(assertionVerificationMethodId)
  })
})
