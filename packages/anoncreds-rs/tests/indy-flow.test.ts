import {
  AnonCredsModuleConfig,
  LegacyIndyCredentialFormatService,
  AnonCredsHolderServiceSymbol,
  AnonCredsIssuerServiceSymbol,
  AnonCredsVerifierServiceSymbol,
  AnonCredsRegistryService,
  AnonCredsSchemaRecord,
  AnonCredsSchemaRepository,
  AnonCredsCredentialDefinitionRepository,
  AnonCredsCredentialDefinitionRecord,
  AnonCredsCredentialDefinitionPrivateRepository,
  AnonCredsCredentialDefinitionPrivateRecord,
  AnonCredsKeyCorrectnessProofRepository,
  AnonCredsKeyCorrectnessProofRecord,
  AnonCredsLinkSecretRepository,
  AnonCredsLinkSecretRecord,
} from '@aries-framework/anoncreds'
import {
  CredentialState,
  CredentialExchangeRecord,
  CredentialPreviewAttribute,
  InjectionSymbols,
} from '@aries-framework/core'
import { Subject } from 'rxjs'

import { InMemoryStorageService } from '../../../tests/InMemoryStorageService'
import { InMemoryAnonCredsRegistry } from '../../anoncreds/tests/InMemoryAnonCredsRegistry'
import { agentDependencies, getAgentConfig, getAgentContext } from '../../core/tests/helpers'
import { AnonCredsRsHolderService } from '../src/services/AnonCredsRsHolderService'
import { AnonCredsRsIssuerService } from '../src/services/AnonCredsRsIssuerService'
import { AnonCredsRsVerifierService } from '../src/services/AnonCredsRsVerifierService'

const registry = new InMemoryAnonCredsRegistry()
const anonCredsModuleConfig = new AnonCredsModuleConfig({
  registries: [registry],
})

const agentConfig = getAgentConfig('LegacyIndyCredentialFormatService')
const anonCredsVerifierService = new AnonCredsRsVerifierService()
const anonCredsHolderService = new AnonCredsRsHolderService()
const anonCredsIssuerService = new AnonCredsRsIssuerService()

const inMemoryStorageService = new InMemoryStorageService()
const agentContext = getAgentContext({
  registerInstances: [
    [InjectionSymbols.Stop$, new Subject<boolean>()],
    [InjectionSymbols.AgentDependencies, agentDependencies],
    [InjectionSymbols.StorageService, inMemoryStorageService],
    [AnonCredsIssuerServiceSymbol, anonCredsIssuerService],
    [AnonCredsHolderServiceSymbol, anonCredsHolderService],
    [AnonCredsVerifierServiceSymbol, anonCredsVerifierService],
    [AnonCredsRegistryService, new AnonCredsRegistryService()],
    [AnonCredsModuleConfig, anonCredsModuleConfig],
  ],
  agentConfig,
})

const legacyIndyCredentialFormatService = new LegacyIndyCredentialFormatService()

describe('LegacyIndyCredentialFormatService using anoncreds-rs', () => {
  test('issuance flow starting from proposal without negotiation and without revocation', async () => {
    // This is just so we don't have to register an actually indy did (as we don't have the indy did registrar configured)
    const indyDid = 'TL1EaPFCZ8Si5aUrqScBDt'

    const schema = await anonCredsIssuerService.createSchema(agentContext, {
      attrNames: ['name', 'age'],
      issuerId: indyDid,
      name: 'Employee Credential',
      version: '1.0.0',
    })

    const { schemaState, schemaMetadata } = await registry.registerSchema(agentContext, {
      schema,
      options: {},
    })

    const { credentialDefinition, credentialDefinitionPrivate, keyCorrectnessProof } =
      await anonCredsIssuerService.createCredentialDefinition(agentContext, {
        issuerId: indyDid,
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
      })
    )

    await agentContext.dependencyManager.resolve(AnonCredsCredentialDefinitionRepository).save(
      agentContext,
      new AnonCredsCredentialDefinitionRecord({
        credentialDefinition: credentialDefinitionState.credentialDefinition,
        credentialDefinitionId: credentialDefinitionState.credentialDefinitionId,
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

    const linkSecret = await anonCredsHolderService.createLinkSecret(agentContext, { linkSecretId: 'linkSecretId' })
    expect(linkSecret.linkSecretId).toBe('linkSecretId')

    await agentContext.dependencyManager.resolve(AnonCredsLinkSecretRepository).save(
      agentContext,
      new AnonCredsLinkSecretRecord({
        value: linkSecret.linkSecretValue,
        linkSecretId: linkSecret.linkSecretId,
      })
    )

    const holderCredentialRecord = new CredentialExchangeRecord({
      protocolVersion: 'v1',
      state: CredentialState.ProposalSent,
      threadId: 'f365c1a5-2baf-4873-9432-fa87c888a0aa',
    })

    const issuerCredentialRecord = new CredentialExchangeRecord({
      protocolVersion: 'v1',
      state: CredentialState.ProposalReceived,
      threadId: 'f365c1a5-2baf-4873-9432-fa87c888a0aa',
    })

    const credentialAttributes = [
      new CredentialPreviewAttribute({
        name: 'name',
        value: 'John',
      }),
      new CredentialPreviewAttribute({
        name: 'age',
        value: '25',
      }),
    ]

    // Holder creates proposal
    holderCredentialRecord.credentialAttributes = credentialAttributes
    const { attachment: proposalAttachment } = await legacyIndyCredentialFormatService.createProposal(agentContext, {
      credentialRecord: holderCredentialRecord,
      credentialFormats: {
        indy: {
          attributes: credentialAttributes,
          credentialDefinitionId: credentialDefinitionState.credentialDefinitionId,
        },
      },
    })

    // Issuer processes and accepts proposal
    await legacyIndyCredentialFormatService.processProposal(agentContext, {
      credentialRecord: issuerCredentialRecord,
      attachment: proposalAttachment,
    })
    // Set attributes on the credential record, this is normally done by the protocol service
    issuerCredentialRecord.credentialAttributes = credentialAttributes
    const { attachment: offerAttachment } = await legacyIndyCredentialFormatService.acceptProposal(agentContext, {
      credentialRecord: issuerCredentialRecord,
      proposalAttachment: proposalAttachment,
    })

    // Holder processes and accepts offer
    await legacyIndyCredentialFormatService.processOffer(agentContext, {
      credentialRecord: holderCredentialRecord,
      attachment: offerAttachment,
    })
    const { attachment: requestAttachment } = await legacyIndyCredentialFormatService.acceptOffer(agentContext, {
      credentialRecord: holderCredentialRecord,
      offerAttachment,
      credentialFormats: {
        indy: {
          linkSecretId: linkSecret.linkSecretId,
        },
      },
    })

    // Issuer processes and accepts request
    await legacyIndyCredentialFormatService.processRequest(agentContext, {
      credentialRecord: issuerCredentialRecord,
      attachment: requestAttachment,
    })
    const { attachment: credentialAttachment } = await legacyIndyCredentialFormatService.acceptRequest(agentContext, {
      credentialRecord: issuerCredentialRecord,
      requestAttachment,
      offerAttachment,
    })

    // Holder processes and accepts credential
    await legacyIndyCredentialFormatService.processCredential(agentContext, {
      credentialRecord: holderCredentialRecord,
      attachment: credentialAttachment,
      requestAttachment,
    })

    expect(holderCredentialRecord.credentials).toEqual([
      { credentialRecordType: 'anoncreds', credentialRecordId: expect.any(String) },
    ])

    const credentialId = holderCredentialRecord.credentials[0].credentialRecordId
    const anonCredsCredential = await anonCredsHolderService.getCredential(agentContext, {
      credentialId,
    })

    expect(anonCredsCredential).toEqual({
      credentialId,
      attributes: {
        age: '25',
        name: 'John',
      },
      schemaId: schemaState.schemaId,
      credentialDefinitionId: credentialDefinitionState.credentialDefinitionId,
      revocationRegistryId: null,
      credentialRevocationId: undefined, // FIXME: should be null?
    })

    expect(holderCredentialRecord.metadata.data).toEqual({
      '_anonCreds/anonCredsCredential': {
        schemaId: schemaState.schemaId,
        credentialDefinitionId: credentialDefinitionState.credentialDefinitionId,
      },
      '_anonCreds/anonCredsCredentialRequest': {
        master_secret_blinding_data: expect.any(Object),
        master_secret_name: expect.any(String),
        nonce: expect.any(String),
      },
    })

    expect(issuerCredentialRecord.metadata.data).toEqual({
      '_anonCreds/anonCredsCredential': {
        schemaId: schemaState.schemaId,
        credentialDefinitionId: credentialDefinitionState.credentialDefinitionId,
      },
    })
  })
})
