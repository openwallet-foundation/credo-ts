import type { AnonCredsCredentialRequest } from '@aries-framework/anoncreds'
import type { Wallet } from '@aries-framework/core'

import {
  AnonCredsModuleConfig,
  AnonCredsHolderServiceSymbol,
  AnonCredsIssuerServiceSymbol,
  AnonCredsVerifierServiceSymbol,
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
  AnonCredsProofFormatService,
  AnonCredsCredentialFormatService,
} from '@aries-framework/anoncreds'
import {
  CredentialState,
  CredentialExchangeRecord,
  CredentialPreviewAttribute,
  InjectionSymbols,
  ProofState,
  ProofExchangeRecord,
} from '@aries-framework/core'
import { Subject } from 'rxjs'

import { InMemoryStorageService } from '../../../tests/InMemoryStorageService'
import { describeRunInNodeVersion } from '../../../tests/runInVersion'
import { AnonCredsRegistryService } from '../../anoncreds/src/services/registry/AnonCredsRegistryService'
import { InMemoryAnonCredsRegistry } from '../../anoncreds/tests/InMemoryAnonCredsRegistry'
import { agentDependencies, getAgentConfig, getAgentContext } from '../../core/tests/helpers'
import { AnonCredsRsHolderService } from '../src/services/AnonCredsRsHolderService'
import { AnonCredsRsIssuerService } from '../src/services/AnonCredsRsIssuerService'
import { AnonCredsRsVerifierService } from '../src/services/AnonCredsRsVerifierService'

const registry = new InMemoryAnonCredsRegistry({ useLegacyIdentifiers: false })
const anonCredsModuleConfig = new AnonCredsModuleConfig({
  registries: [registry],
})

const agentConfig = getAgentConfig('AnonCreds format services using anoncreds-rs')
const anonCredsVerifierService = new AnonCredsRsVerifierService()
const anonCredsHolderService = new AnonCredsRsHolderService()
const anonCredsIssuerService = new AnonCredsRsIssuerService()

const wallet = { generateNonce: () => Promise.resolve('947121108704767252195123') } as Wallet

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
  wallet,
})

const anoncredsCredentialFormatService = new AnonCredsCredentialFormatService()
const anoncredsProofFormatService = new AnonCredsProofFormatService()

const indyDid = 'did:indy:local:LjgpST2rjsoxYegQDRm7EL'

// FIXME: Re-include in tests when NodeJS wrapper performance is improved
describeRunInNodeVersion([18], 'AnonCreds format services using anoncreds-rs', () => {
  test('issuance and verification flow starting from proposal without negotiation and without revocation', async () => {
    const schema = await anonCredsIssuerService.createSchema(agentContext, {
      attrNames: ['name', 'age'],
      issuerId: indyDid,
      name: 'Employee Credential',
      version: '1.0.0',
    })

    const { schemaState } = await registry.registerSchema(agentContext, {
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
    const { attachment: proposalAttachment } = await anoncredsCredentialFormatService.createProposal(agentContext, {
      credentialRecord: holderCredentialRecord,
      credentialFormats: {
        anoncreds: {
          attributes: credentialAttributes,
          credentialDefinitionId: credentialDefinitionState.credentialDefinitionId,
        },
      },
    })

    // Issuer processes and accepts proposal
    await anoncredsCredentialFormatService.processProposal(agentContext, {
      credentialRecord: issuerCredentialRecord,
      attachment: proposalAttachment,
    })
    // Set attributes on the credential record, this is normally done by the protocol service
    issuerCredentialRecord.credentialAttributes = credentialAttributes
    const { attachment: offerAttachment } = await anoncredsCredentialFormatService.acceptProposal(agentContext, {
      credentialRecord: issuerCredentialRecord,
      proposalAttachment: proposalAttachment,
    })

    // Holder processes and accepts offer
    await anoncredsCredentialFormatService.processOffer(agentContext, {
      credentialRecord: holderCredentialRecord,
      attachment: offerAttachment,
    })
    const { attachment: requestAttachment } = await anoncredsCredentialFormatService.acceptOffer(agentContext, {
      credentialRecord: holderCredentialRecord,
      offerAttachment,
      credentialFormats: {
        anoncreds: {
          linkSecretId: linkSecret.linkSecretId,
        },
      },
    })

    // Make sure the request contains an entropy and does not contain a prover_did field
    expect((requestAttachment.getDataAsJson() as AnonCredsCredentialRequest).entropy).toBeDefined()
    expect((requestAttachment.getDataAsJson() as AnonCredsCredentialRequest).prover_did).toBeUndefined()

    // Issuer processes and accepts request
    await anoncredsCredentialFormatService.processRequest(agentContext, {
      credentialRecord: issuerCredentialRecord,
      attachment: requestAttachment,
    })
    const { attachment: credentialAttachment } = await anoncredsCredentialFormatService.acceptRequest(agentContext, {
      credentialRecord: issuerCredentialRecord,
      requestAttachment,
      offerAttachment,
    })

    // Holder processes and accepts credential
    await anoncredsCredentialFormatService.processCredential(agentContext, {
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
      methodName: 'inMemory',
    })

    expect(holderCredentialRecord.metadata.data).toEqual({
      '_anoncreds/credential': {
        schemaId: schemaState.schemaId,
        credentialDefinitionId: credentialDefinitionState.credentialDefinitionId,
      },
      '_anoncreds/credentialRequest': {
        master_secret_blinding_data: expect.any(Object),
        master_secret_name: expect.any(String),
        nonce: expect.any(String),
      },
    })

    expect(issuerCredentialRecord.metadata.data).toEqual({
      '_anoncreds/credential': {
        schemaId: schemaState.schemaId,
        credentialDefinitionId: credentialDefinitionState.credentialDefinitionId,
      },
    })

    const holderProofRecord = new ProofExchangeRecord({
      protocolVersion: 'v1',
      state: ProofState.ProposalSent,
      threadId: '4f5659a4-1aea-4f42-8c22-9a9985b35e38',
    })
    const verifierProofRecord = new ProofExchangeRecord({
      protocolVersion: 'v1',
      state: ProofState.ProposalReceived,
      threadId: '4f5659a4-1aea-4f42-8c22-9a9985b35e38',
    })

    const { attachment: proofProposalAttachment } = await anoncredsProofFormatService.createProposal(agentContext, {
      proofFormats: {
        anoncreds: {
          attributes: [
            {
              name: 'name',
              credentialDefinitionId: credentialDefinitionState.credentialDefinitionId,
              value: 'John',
              referent: '1',
            },
          ],
          predicates: [
            {
              credentialDefinitionId: credentialDefinitionState.credentialDefinitionId,
              name: 'age',
              predicate: '>=',
              threshold: 18,
            },
          ],
          name: 'Proof Request',
          version: '1.0',
        },
      },
      proofRecord: holderProofRecord,
    })

    await anoncredsProofFormatService.processProposal(agentContext, {
      attachment: proofProposalAttachment,
      proofRecord: verifierProofRecord,
    })

    const { attachment: proofRequestAttachment } = await anoncredsProofFormatService.acceptProposal(agentContext, {
      proofRecord: verifierProofRecord,
      proposalAttachment: proofProposalAttachment,
    })

    await anoncredsProofFormatService.processRequest(agentContext, {
      attachment: proofRequestAttachment,
      proofRecord: holderProofRecord,
    })

    const { attachment: proofAttachment } = await anoncredsProofFormatService.acceptRequest(agentContext, {
      proofRecord: holderProofRecord,
      requestAttachment: proofRequestAttachment,
      proposalAttachment: proofProposalAttachment,
    })

    const isValid = await anoncredsProofFormatService.processPresentation(agentContext, {
      attachment: proofAttachment,
      proofRecord: verifierProofRecord,
      requestAttachment: proofRequestAttachment,
    })

    expect(isValid).toBe(true)
  })
})
