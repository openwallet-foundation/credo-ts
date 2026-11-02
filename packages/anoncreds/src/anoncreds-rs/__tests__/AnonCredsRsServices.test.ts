import type { AnonCredsProofRequest } from '@credo-ts/anoncreds'
import {
  AnonCredsCredentialDefinitionPrivateRecord,
  AnonCredsCredentialDefinitionPrivateRepository,
  AnonCredsCredentialDefinitionRecord,
  AnonCredsCredentialDefinitionRepository,
  AnonCredsHolderServiceSymbol,
  AnonCredsIssuerServiceSymbol,
  AnonCredsKeyCorrectnessProofRecord,
  AnonCredsKeyCorrectnessProofRepository,
  AnonCredsLinkSecretRecord,
  AnonCredsLinkSecretRepository,
  AnonCredsModuleConfig,
  AnonCredsSchemaRecord,
  AnonCredsSchemaRepository,
  AnonCredsVerifierServiceSymbol,
} from '@credo-ts/anoncreds'
import type { DidRepository } from '@credo-ts/core'
import {
  CacheModuleConfig,
  DidResolverService,
  DidsModuleConfig,
  InjectionSymbols,
  InMemoryLruCache,
  JsonLdModuleConfig,
  SignatureSuiteRegistry,
  W3cCredentialRepository,
  W3cCredentialsModuleConfig,
  type W3cJsonLdVerifiableCredential,
} from '@credo-ts/core'
import { NativeAnoncreds } from '@hyperledger/anoncreds-nodejs'
import { Subject } from 'rxjs'
import { InMemoryStorageService } from '../../../../../tests/InMemoryStorageService'
import { InMemoryAnonCredsRegistry } from '../../../../anoncreds/tests/InMemoryAnonCredsRegistry'
import { testLogger } from '../../../../core/tests'
import { agentDependencies, getAgentConfig, getAgentContext } from '../../../../core/tests/helpers'
import { trackNativeAnonCredsObjects } from '../../../tests/nativeAnonCredsObjects'
import { encodeCredentialValue } from '../../utils/credential'
import { AnonCredsRsHolderService } from '../AnonCredsRsHolderService'
import { AnonCredsRsIssuerService } from '../AnonCredsRsIssuerService'
import { AnonCredsRsVerifierService } from '../AnonCredsRsVerifierService'

const agentConfig = getAgentConfig('AnonCredsCredentialFormatServiceTest')
const anonCredsVerifierService = new AnonCredsRsVerifierService()
const anonCredsHolderService = new AnonCredsRsHolderService()
const anonCredsIssuerService = new AnonCredsRsIssuerService()
const storageService = new InMemoryStorageService()
const registry = new InMemoryAnonCredsRegistry()

const agentContext = getAgentContext({
  registerInstances: [
    [InjectionSymbols.Stop$, new Subject<boolean>()],
    [InjectionSymbols.AgentDependencies, agentDependencies],
    [InjectionSymbols.StorageService, storageService],
    [AnonCredsIssuerServiceSymbol, anonCredsIssuerService],
    [AnonCredsHolderServiceSymbol, anonCredsHolderService],
    [AnonCredsVerifierServiceSymbol, anonCredsVerifierService],
    [
      AnonCredsModuleConfig,
      new AnonCredsModuleConfig({
        registries: [registry],
        anoncreds: NativeAnoncreds,
      }),
    ],
    [
      CacheModuleConfig,
      new CacheModuleConfig({
        cache: new InMemoryLruCache({ limit: 500 }),
      }),
    ],

    [InjectionSymbols.Logger, testLogger],
    [DidResolverService, new DidResolverService(testLogger, new DidsModuleConfig(), {} as unknown as DidRepository)],
    [W3cCredentialsModuleConfig, new W3cCredentialsModuleConfig()],
    [JsonLdModuleConfig, new JsonLdModuleConfig()],
    [SignatureSuiteRegistry, new SignatureSuiteRegistry()],
  ],
  agentConfig,
})

describe('AnonCredsRsServices', () => {
  // Credo frees every native AnonCreds object it creates
  const nativeAnonCredsObjects = trackNativeAnonCredsObjects()
  afterEach(() => {
    expect(nativeAnonCredsObjects.takeOpen()).toEqual([])
  })
  afterAll(() => nativeAnonCredsObjects.stop())

  test('issuance flow without revocation', async () => {
    const issuerId = 'did:indy:pool:localtest:TL1EaPFCZ8Si5aUrqScBDt'

    const schema = await anonCredsIssuerService.createSchema(agentContext, {
      attrNames: ['name', 'age'],
      issuerId,
      name: 'Employee Credential',
      version: '1.0.0',
    })

    const { schemaState } = await registry.registerSchema(agentContext, {
      schema,
      options: {},
    })

    const { credentialDefinition, credentialDefinitionPrivate, keyCorrectnessProof } =
      await anonCredsIssuerService.createCredentialDefinition(agentContext, {
        issuerId,
        schemaId: schemaState.schemaId as string,
        schema,
        tag: 'Employee Credential',
        supportRevocation: false,
      })

    const { credentialDefinitionState } = await registry.registerCredentialDefinition(agentContext, {
      credentialDefinition,
      options: {},
    })

    if (
      !credentialDefinitionState.credentialDefinition ||
      !credentialDefinitionState.credentialDefinitionId ||
      !schemaState.schema ||
      !schemaState.schemaId
    ) {
      throw new Error('Failed to create schema or credential definition')
    }

    if (!credentialDefinitionPrivate || !keyCorrectnessProof) {
      throw new Error('Failed to get private part of credential definition')
    }

    await agentContext.dependencyManager.resolve(AnonCredsSchemaRepository).save(
      agentContext,
      new AnonCredsSchemaRecord({
        schema: schemaState.schema,
        schemaId: schemaState.schemaId,
        methodName: 'inMemory',
      })
    )

    await agentContext.dependencyManager.resolve(AnonCredsCredentialDefinitionRepository).save(
      agentContext,
      new AnonCredsCredentialDefinitionRecord({
        credentialDefinition: credentialDefinitionState.credentialDefinition,
        credentialDefinitionId: credentialDefinitionState.credentialDefinitionId,
        methodName: 'inMemory',
      })
    )

    await agentContext.dependencyManager.resolve(AnonCredsCredentialDefinitionPrivateRepository).save(
      agentContext,
      new AnonCredsCredentialDefinitionPrivateRecord({
        value: credentialDefinitionPrivate,
        credentialDefinitionId: credentialDefinitionState.credentialDefinitionId,
      })
    )

    await agentContext.dependencyManager.resolve(AnonCredsKeyCorrectnessProofRepository).save(
      agentContext,
      new AnonCredsKeyCorrectnessProofRecord({
        value: keyCorrectnessProof,
        credentialDefinitionId: credentialDefinitionState.credentialDefinitionId,
      })
    )

    const credentialOffer = await anonCredsIssuerService.createCredentialOffer(agentContext, {
      credentialDefinitionId: credentialDefinitionState.credentialDefinitionId,
    })

    const linkSecret = await anonCredsHolderService.createLinkSecret(agentContext, { linkSecretId: 'linkSecretId' })
    expect(linkSecret.linkSecretId).toBe('linkSecretId')

    await agentContext.dependencyManager.resolve(AnonCredsLinkSecretRepository).save(
      agentContext,
      new AnonCredsLinkSecretRecord({
        value: linkSecret.linkSecretValue,
        linkSecretId: linkSecret.linkSecretId,
      })
    )

    const credentialRequestState = await anonCredsHolderService.createCredentialRequest(agentContext, {
      credentialDefinition: credentialDefinitionState.credentialDefinition,
      credentialOffer,
      linkSecretId: linkSecret.linkSecretId,
    })

    const { credential } = await anonCredsIssuerService.createCredential(agentContext, {
      credentialOffer,
      credentialRequest: credentialRequestState.credentialRequest,
      credentialValues: {
        name: { raw: 'John', encoded: encodeCredentialValue('John') },
        age: { raw: '25', encoded: encodeCredentialValue('25') },
      },
    })

    const credentialId = await anonCredsHolderService.storeCredential(agentContext, {
      credential,
      credentialDefinition,
      schema,
      credentialDefinitionId: credentialDefinitionState.credentialDefinitionId,
      credentialRequestMetadata: credentialRequestState.credentialRequestMetadata,
    })

    const credentialInfo = await anonCredsHolderService.getCredential(agentContext, {
      id: credentialId,
    })

    expect(credentialInfo).toEqual({
      credentialId,
      attributes: {
        age: 25,
        name: 'John',
      },
      linkSecretId: 'linkSecretId',
      schemaId: schemaState.schemaId,
      credentialDefinitionId: credentialDefinitionState.credentialDefinitionId,
      revocationRegistryId: null,
      credentialRevocationId: null,
      methodName: 'inMemory',
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    })

    const proofRequest: AnonCredsProofRequest = {
      nonce: NativeAnoncreds.instance.generateNonce(),
      name: 'pres_req_1',
      version: '0.1',
      requested_attributes: {
        attr1_referent: {
          name: 'name',
        },
      },
      requested_predicates: {
        predicate1_referent: { name: 'age', p_type: '>=' as const, p_value: 18 },
      },
    }

    const proof = await anonCredsHolderService.createProof(agentContext, {
      credentialDefinitions: { [credentialDefinitionState.credentialDefinitionId]: credentialDefinition },
      proofRequest,
      selectedCredentials: {
        attributes: {
          attr1_referent: { credentialId, credentialInfo, revealed: true },
        },
        predicates: {
          predicate1_referent: { credentialId, credentialInfo },
        },
        selfAttestedAttributes: {},
      },
      schemas: { [schemaState.schemaId]: schema },
      revocationRegistries: {},
    })

    const verifiedProof = await anonCredsVerifierService.verifyProof(agentContext, {
      credentialDefinitions: { [credentialDefinitionState.credentialDefinitionId]: credentialDefinition },
      proof,
      proofRequest,
      schemas: { [schemaState.schemaId]: schema },
      revocationRegistries: {},
    })

    expect(verifiedProof).toBeTruthy()

    // A restriction with the percent-encoded form of the unencoded ids matches the same credential
    const encodedRestriction = {
      schema_id: schemaState.schemaId.replace('Employee Credential', 'Employee%20Credential'),
      cred_def_id: credentialDefinitionState.credentialDefinitionId.replace(
        'Employee Credential',
        'Employee%20Credential'
      ),
    }
    expect(encodedRestriction.cred_def_id).not.toEqual(credentialDefinitionState.credentialDefinitionId)

    const encodedProofRequest: AnonCredsProofRequest = {
      ...proofRequest,
      nonce: NativeAnoncreds.instance.generateNonce(),
      requested_attributes: { attr1_referent: { name: 'name', restrictions: [encodedRestriction] } },
      requested_predicates: {},
    }

    const credentialsForRequest = await anonCredsHolderService.getCredentialsForProofRequest(agentContext, {
      proofRequest: encodedProofRequest,
      attributeReferent: 'attr1_referent',
    })
    expect(credentialsForRequest).toHaveLength(1)

    const encodedProof = await anonCredsHolderService.createProof(agentContext, {
      credentialDefinitions: { [credentialDefinitionState.credentialDefinitionId]: credentialDefinition },
      proofRequest: encodedProofRequest,
      selectedCredentials: {
        attributes: { attr1_referent: { credentialId, credentialInfo, revealed: true } },
        predicates: {},
        selfAttestedAttributes: {},
      },
      schemas: { [schemaState.schemaId]: schema },
      revocationRegistries: {},
    })

    expect(
      await anonCredsVerifierService.verifyProof(agentContext, {
        credentialDefinitions: { [credentialDefinitionState.credentialDefinitionId]: credentialDefinition },
        proof: encodedProof,
        proofRequest: encodedProofRequest,
        schemas: { [schemaState.schemaId]: schema },
        revocationRegistries: {},
      })
    ).toBe(true)
  })

  test('issuance and proofs with did:indy ids in both percent-encoded and unencoded form', async () => {
    const issuerId = 'did:indy:pool:localtest:A4CYPASJYRZRt98YWrac3H'
    const unencoded = {
      schemaId: `${issuerId}/anoncreds/v0/SCHEMA/Mixed Credential/1.0.0`,
      credentialDefinitionId: `${issuerId}/anoncreds/v0/CLAIM_DEF/1/Mixed Credential`,
    }
    const encoded = {
      schemaId: `${issuerId}/anoncreds/v0/SCHEMA/Mixed%20Credential/1.0.0`,
      credentialDefinitionId: `${issuerId}/anoncreds/v0/CLAIM_DEF/1/Mixed%20Credential`,
    }

    const schema = await anonCredsIssuerService.createSchema(agentContext, {
      attrNames: ['name', 'age'],
      issuerId,
      name: 'Mixed Credential',
      version: '1.0.0',
    })
    const { credentialDefinition, credentialDefinitionPrivate, keyCorrectnessProof } =
      await anonCredsIssuerService.createCredentialDefinition(agentContext, {
        issuerId,
        schemaId: unencoded.schemaId,
        schema,
        tag: 'Mixed Credential',
        supportRevocation: false,
      })
    if (!credentialDefinitionPrivate || !keyCorrectnessProof) {
      throw new Error('Failed to get private part of credential definition')
    }

    // Issuer records created before ids were percent-encoded
    await agentContext.dependencyManager.resolve(AnonCredsCredentialDefinitionRepository).save(
      agentContext,
      new AnonCredsCredentialDefinitionRecord({
        credentialDefinition,
        credentialDefinitionId: unencoded.credentialDefinitionId,
        methodName: 'inMemory',
      })
    )
    await agentContext.dependencyManager.resolve(AnonCredsCredentialDefinitionPrivateRepository).save(
      agentContext,
      new AnonCredsCredentialDefinitionPrivateRecord({
        value: credentialDefinitionPrivate,
        credentialDefinitionId: unencoded.credentialDefinitionId,
      })
    )
    await agentContext.dependencyManager.resolve(AnonCredsKeyCorrectnessProofRepository).save(
      agentContext,
      new AnonCredsKeyCorrectnessProofRecord({
        value: keyCorrectnessProof,
        credentialDefinitionId: unencoded.credentialDefinitionId,
      })
    )

    // The issuer finds the records with the percent-encoded id
    const credentialOffer = await anonCredsIssuerService.createCredentialOffer(agentContext, {
      credentialDefinitionId: encoded.credentialDefinitionId,
    })
    expect(credentialOffer.cred_def_id).toEqual(encoded.credentialDefinitionId)
    expect(credentialOffer.schema_id).toEqual(unencoded.schemaId)

    const linkSecret = await anonCredsHolderService.createLinkSecret(agentContext, {
      linkSecretId: 'mixedLinkSecretId',
    })
    await agentContext.dependencyManager
      .resolve(AnonCredsLinkSecretRepository)
      .save(
        agentContext,
        new AnonCredsLinkSecretRecord({ value: linkSecret.linkSecretValue, linkSecretId: linkSecret.linkSecretId })
      )

    const credentialRequestState = await anonCredsHolderService.createCredentialRequest(agentContext, {
      credentialDefinition,
      credentialOffer,
      linkSecretId: linkSecret.linkSecretId,
    })
    const { credential } = await anonCredsIssuerService.createCredential(agentContext, {
      credentialOffer,
      credentialRequest: credentialRequestState.credentialRequest,
      credentialValues: {
        name: { raw: 'John', encoded: encodeCredentialValue('John') },
        age: { raw: '25', encoded: encodeCredentialValue('25') },
      },
    })

    // The resolver returns the schema id in the other form than the credential
    const credentialId = await anonCredsHolderService.storeCredential(agentContext, {
      credential,
      credentialDefinition: { ...credentialDefinition, schemaId: encoded.schemaId },
      schema,
      credentialDefinitionId: credential.cred_def_id,
      credentialRequestMetadata: credentialRequestState.credentialRequestMetadata,
    })
    const credentialInfo = await anonCredsHolderService.getCredential(agentContext, { id: credentialId })
    expect(credentialInfo).toMatchObject({
      schemaId: encoded.schemaId,
      credentialDefinitionId: encoded.credentialDefinitionId,
    })

    expect(
      await anonCredsHolderService.getCredentials(agentContext, {
        credentialDefinitionId: unencoded.credentialDefinitionId,
        schemaId: unencoded.schemaId,
      })
    ).toEqual([expect.objectContaining({ credentialId })])

    const proofRequest: AnonCredsProofRequest = {
      nonce: NativeAnoncreds.instance.generateNonce(),
      name: 'pres_req_1',
      version: '0.1',
      requested_attributes: {
        attr1_referent: { name: 'name', restrictions: [{ cred_def_id: unencoded.credentialDefinitionId }] },
      },
      requested_predicates: {
        predicate1_referent: {
          name: 'age',
          p_type: '>=' as const,
          p_value: 18,
          restrictions: [{ schema_id: unencoded.schemaId }],
        },
      },
    }
    for (const referent of ['attr1_referent', 'predicate1_referent']) {
      expect(
        await anonCredsHolderService.getCredentialsForProofRequest(agentContext, {
          proofRequest,
          attributeReferent: referent,
        })
      ).toEqual([expect.objectContaining({ credentialInfo: expect.objectContaining({ credentialId }) })])
    }

    // Objects keyed by the other form of the ids than in the stored credential
    const proof = await anonCredsHolderService.createProof(agentContext, {
      credentialDefinitions: { [unencoded.credentialDefinitionId]: credentialDefinition },
      proofRequest,
      selectedCredentials: {
        attributes: { attr1_referent: { credentialId, credentialInfo, revealed: true } },
        predicates: { predicate1_referent: { credentialId, credentialInfo } },
        selfAttestedAttributes: {},
      },
      schemas: { [unencoded.schemaId]: schema },
      revocationRegistries: {},
    })
    expect(proof.identifiers).toEqual([
      expect.objectContaining({ schema_id: encoded.schemaId, cred_def_id: encoded.credentialDefinitionId }),
    ])

    expect(
      await anonCredsVerifierService.verifyProof(agentContext, {
        credentialDefinitions: { [unencoded.credentialDefinitionId]: credentialDefinition },
        proof,
        proofRequest,
        schemas: { [unencoded.schemaId]: schema },
        revocationRegistries: {},
      })
    ).toBe(true)

    // W3C presentations: the schema is keyed by the resolver's form, the credential contains the issuer's form
    const w3cCredential = (
      await agentContext.dependencyManager.resolve(W3cCredentialRepository).getById(agentContext, credentialId)
    ).firstCredential as W3cJsonLdVerifiableCredential
    const w3cProofRequest: AnonCredsProofRequest = {
      nonce: NativeAnoncreds.instance.generateNonce(),
      name: 'pres_req_w3c',
      version: '0.1',
      requested_attributes: {
        attr1_referent: { names: ['name'], restrictions: [{ cred_def_id: unencoded.credentialDefinitionId }] },
      },
      requested_predicates: {},
    }
    const w3cObjects = {
      schemas: { [encoded.schemaId]: schema },
      credentialDefinitions: { [unencoded.credentialDefinitionId]: credentialDefinition },
      credentialsWithRevocationMetadata: [{ credential: w3cCredential }],
    }
    const w3cPresentation = await anonCredsHolderService.createW3cPresentation(agentContext, {
      ...w3cObjects,
      proofRequest: w3cProofRequest,
      linkSecretId: linkSecret.linkSecretId,
      credentialsProve: [{ entryIndex: 0, referent: 'attr1_referent', isPredicate: false, reveal: true }],
    })
    expect(
      await anonCredsVerifierService.verifyW3cPresentation(agentContext, {
        ...w3cObjects,
        presentation: w3cPresentation,
        proofRequest: w3cProofRequest,
      })
    ).toBe(true)
  })
})
