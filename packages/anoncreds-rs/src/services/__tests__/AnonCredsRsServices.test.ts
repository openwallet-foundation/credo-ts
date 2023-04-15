import type { AnonCredsProofRequest } from '@aries-framework/anoncreds'

import {
  getUnqualifiedSchemaId,
  parseIndySchemaId,
  getUnqualifiedCredentialDefinitionId,
  parseIndyCredentialDefinitionId,
  AnonCredsModuleConfig,
  AnonCredsHolderServiceSymbol,
  AnonCredsIssuerServiceSymbol,
  AnonCredsVerifierServiceSymbol,
  AnonCredsSchemaRepository,
  AnonCredsSchemaRecord,
  AnonCredsCredentialDefinitionRecord,
  AnonCredsCredentialDefinitionRepository,
  AnonCredsCredentialDefinitionPrivateRecord,
  AnonCredsCredentialDefinitionPrivateRepository,
  AnonCredsKeyCorrectnessProofRepository,
  AnonCredsKeyCorrectnessProofRecord,
  AnonCredsLinkSecretRepository,
  AnonCredsLinkSecretRecord,
} from '@aries-framework/anoncreds'
import { InjectionSymbols } from '@aries-framework/core'
import { anoncreds } from '@hyperledger/anoncreds-nodejs'
import { Subject } from 'rxjs'

import { InMemoryStorageService } from '../../../../../tests/InMemoryStorageService'
import { describeRunInNodeVersion } from '../../../../../tests/runInVersion'
import { encodeCredentialValue } from '../../../../anoncreds/src/utils/credential'
import { InMemoryAnonCredsRegistry } from '../../../../anoncreds/tests/InMemoryAnonCredsRegistry'
import { agentDependencies, getAgentConfig, getAgentContext } from '../../../../core/tests/helpers'
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
      }),
    ],
  ],
  agentConfig,
})

// FIXME: Re-include in tests when NodeJS wrapper performance is improved
describeRunInNodeVersion([18], 'AnonCredsRsServices', () => {
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

    const credentialId = 'holderCredentialId'

    const storedId = await anonCredsHolderService.storeCredential(agentContext, {
      credential,
      credentialDefinition,
      schema,
      credentialDefinitionId: credentialDefinitionState.credentialDefinitionId,
      credentialRequestMetadata: credentialRequestState.credentialRequestMetadata,
      credentialId,
    })

    expect(storedId).toEqual(credentialId)

    const credentialInfo = await anonCredsHolderService.getCredential(agentContext, {
      credentialId,
    })

    expect(credentialInfo).toEqual({
      credentialId,
      attributes: {
        age: '25',
        name: 'John',
      },
      schemaId: schemaState.schemaId,
      credentialDefinitionId: credentialDefinitionState.credentialDefinitionId,
      revocationRegistryId: null,
      credentialRevocationId: undefined, // Should it be null in this case?
      methodName: 'inMemory',
    })

    const proofRequest: AnonCredsProofRequest = {
      nonce: anoncreds.generateNonce(),
      name: 'pres_req_1',
      version: '0.1',
      requested_attributes: {
        attr1_referent: {
          name: 'name',
        },
        attr2_referent: {
          name: 'age',
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
          attr2_referent: { credentialId, credentialInfo, revealed: true },
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
  })

  test('issuance flow with unqualified identifiers', async () => {
    // Use qualified identifiers to create schema and credential definition (we only support qualified identifiers for these)
    const issuerId = 'did:indy:pool:localtest:A4CYPASJYRZRt98YWrac3H'

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

    const { namespaceIdentifier, schemaSeqNo, tag } = parseIndyCredentialDefinitionId(
      credentialDefinitionState.credentialDefinitionId
    )
    const unqualifiedCredentialDefinitionId = getUnqualifiedCredentialDefinitionId(
      namespaceIdentifier,
      schemaSeqNo,
      tag
    )

    const parsedSchema = parseIndySchemaId(schemaState.schemaId)
    const unqualifiedSchemaId = getUnqualifiedSchemaId(
      parsedSchema.namespaceIdentifier,
      parsedSchema.schemaName,
      parsedSchema.schemaVersion
    )

    // Create offer with unqualified credential definition id
    const credentialOffer = await anonCredsIssuerService.createCredentialOffer(agentContext, {
      credentialDefinitionId: unqualifiedCredentialDefinitionId,
    })

    const linkSecret = await anonCredsHolderService.createLinkSecret(agentContext, { linkSecretId: 'someLinkSecretId' })
    expect(linkSecret.linkSecretId).toBe('someLinkSecretId')

    await agentContext.dependencyManager.resolve(AnonCredsLinkSecretRepository).save(
      agentContext,
      new AnonCredsLinkSecretRecord({
        value: linkSecret.linkSecretValue,
        linkSecretId: linkSecret.linkSecretId,
      })
    )

    const unqualifiedCredentialDefinition = await registry.getCredentialDefinition(
      agentContext,
      credentialOffer.cred_def_id
    )
    const unqualifiedSchema = await registry.getSchema(agentContext, credentialOffer.schema_id)
    if (!unqualifiedCredentialDefinition.credentialDefinition || !unqualifiedSchema.schema) {
      throw new Error('unable to fetch credential definition or schema')
    }

    const credentialRequestState = await anonCredsHolderService.createCredentialRequest(agentContext, {
      credentialDefinition: unqualifiedCredentialDefinition.credentialDefinition,
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

    const credentialId = 'holderCredentialId2'

    const storedId = await anonCredsHolderService.storeCredential(agentContext, {
      credential,
      credentialDefinition: unqualifiedCredentialDefinition.credentialDefinition,
      schema: unqualifiedSchema.schema,
      credentialDefinitionId: credentialOffer.cred_def_id,
      credentialRequestMetadata: credentialRequestState.credentialRequestMetadata,
      credentialId,
    })

    expect(storedId).toEqual(credentialId)

    const credentialInfo = await anonCredsHolderService.getCredential(agentContext, {
      credentialId,
    })

    expect(credentialInfo).toEqual({
      credentialId,
      attributes: {
        age: '25',
        name: 'John',
      },
      schemaId: unqualifiedSchemaId,
      credentialDefinitionId: unqualifiedCredentialDefinitionId,
      revocationRegistryId: null,
      credentialRevocationId: undefined, // Should it be null in this case?
      methodName: 'inMemory',
    })

    const proofRequest: AnonCredsProofRequest = {
      nonce: anoncreds.generateNonce(),
      name: 'pres_req_1',
      version: '0.1',
      requested_attributes: {
        attr1_referent: {
          name: 'name',
        },
        attr2_referent: {
          name: 'age',
        },
      },
      requested_predicates: {
        predicate1_referent: { name: 'age', p_type: '>=' as const, p_value: 18 },
      },
    }

    const proof = await anonCredsHolderService.createProof(agentContext, {
      credentialDefinitions: { [unqualifiedCredentialDefinitionId]: credentialDefinition },
      proofRequest,
      selectedCredentials: {
        attributes: {
          attr1_referent: { credentialId, credentialInfo, revealed: true },
          attr2_referent: { credentialId, credentialInfo, revealed: true },
        },
        predicates: {
          predicate1_referent: { credentialId, credentialInfo },
        },
        selfAttestedAttributes: {},
      },
      schemas: { [unqualifiedSchemaId]: schema },
      revocationRegistries: {},
    })

    const verifiedProof = await anonCredsVerifierService.verifyProof(agentContext, {
      credentialDefinitions: { [unqualifiedCredentialDefinitionId]: credentialDefinition },
      proof,
      proofRequest,
      schemas: { [unqualifiedSchemaId]: schema },
      revocationRegistries: {},
    })

    expect(verifiedProof).toBeTruthy()
  })
})
