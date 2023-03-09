import type { AnonCredsCredentialRequest } from '../../models'

import {
  CredentialState,
  CredentialExchangeRecord,
  SigningProviderRegistry,
  KeyType,
  CredentialPreviewAttribute,
  ProofExchangeRecord,
  ProofState,
  EventEmitter,
} from '@aries-framework/core'
import * as indySdk from 'indy-sdk'
import { Subject } from 'rxjs'

import { agentDependencies, getAgentConfig, getAgentContext } from '../../../../core/tests/helpers'
import {
  IndySdkHolderService,
  IndySdkIssuerService,
  IndySdkStorageService,
  IndySdkVerifierService,
  IndySdkWallet,
} from '../../../../indy-sdk/src'
import { IndySdkRevocationService } from '../../../../indy-sdk/src/anoncreds/services/IndySdkRevocationService'
import {
  getLegacyCredentialDefinitionId,
  getLegacySchemaId,
  parseCredentialDefinitionId,
  parseSchemaId,
} from '../../../../indy-sdk/src/anoncreds/utils/identifiers'
import { legacyIndyDidFromPublicKeyBase58 } from '../../../../indy-sdk/src/utils/did'
import { InMemoryAnonCredsRegistry } from '../../../tests/InMemoryAnonCredsRegistry'
import { AnonCredsModuleConfig } from '../../AnonCredsModuleConfig'
import { AnonCredsLinkSecretRecord, AnonCredsLinkSecretRepository } from '../../repository'
import {
  AnonCredsHolderServiceSymbol,
  AnonCredsIssuerServiceSymbol,
  AnonCredsVerifierServiceSymbol,
} from '../../services'
import { AnonCredsRegistryService } from '../../services/registry/AnonCredsRegistryService'
import { LegacyIndyCredentialFormatService } from '../LegacyIndyCredentialFormatService'
import { LegacyIndyProofFormatService } from '../LegacyIndyProofFormatService'

const registry = new InMemoryAnonCredsRegistry()
const anonCredsModuleConfig = new AnonCredsModuleConfig({
  registries: [registry],
})

const agentConfig = getAgentConfig('LegacyIndyFormatServicesTest')
const anonCredsRevocationService = new IndySdkRevocationService(indySdk)
const anonCredsVerifierService = new IndySdkVerifierService(indySdk)
const anonCredsHolderService = new IndySdkHolderService(anonCredsRevocationService, indySdk)
const anonCredsIssuerService = new IndySdkIssuerService(indySdk)
const wallet = new IndySdkWallet(indySdk, agentConfig.logger, new SigningProviderRegistry([]))
const storageService = new IndySdkStorageService<AnonCredsLinkSecretRecord>(indySdk)
const eventEmitter = new EventEmitter(agentDependencies, new Subject())
const anonCredsLinkSecretRepository = new AnonCredsLinkSecretRepository(storageService, eventEmitter)
const agentContext = getAgentContext({
  registerInstances: [
    [AnonCredsIssuerServiceSymbol, anonCredsIssuerService],
    [AnonCredsHolderServiceSymbol, anonCredsHolderService],
    [AnonCredsVerifierServiceSymbol, anonCredsVerifierService],
    [AnonCredsRegistryService, new AnonCredsRegistryService()],
    [AnonCredsModuleConfig, anonCredsModuleConfig],
    [AnonCredsLinkSecretRepository, anonCredsLinkSecretRepository],
  ],
  agentConfig,
  wallet,
})

const indyCredentialFormatService = new LegacyIndyCredentialFormatService()
const indyProofFormatService = new LegacyIndyProofFormatService()

// We can split up these tests when we can use AnonCredsRS as a backend, but currently
// we need to have the link secrets etc in the wallet which is not so easy to do with Indy
describe('Legacy indy format services', () => {
  beforeEach(async () => {
    await wallet.createAndOpen(agentConfig.walletConfig)
  })

  afterEach(async () => {
    await wallet.delete()
  })

  test('issuance and verification flow starting from proposal without negotiation and without revocation', async () => {
    // This is just so we don't have to register an actual indy did (as we don't have the indy did registrar configured)
    const key = await wallet.createKey({ keyType: KeyType.Ed25519 })
    const unqualifiedIndyDid = legacyIndyDidFromPublicKeyBase58(key.publicKeyBase58)
    const indyDid = `did:indy:pool1:${unqualifiedIndyDid}`

    // Create link secret
    await anonCredsHolderService.createLinkSecret(agentContext, {
      linkSecretId: 'link-secret-id',
    })
    const anonCredsLinkSecret = new AnonCredsLinkSecretRecord({
      linkSecretId: 'link-secret-id',
    })
    anonCredsLinkSecret.setTag('isDefault', true)
    await anonCredsLinkSecretRepository.save(agentContext, anonCredsLinkSecret)

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

    const { credentialDefinition } = await anonCredsIssuerService.createCredentialDefinition(
      agentContext,
      {
        issuerId: indyDid,
        schemaId: schemaState.schemaId as string,
        schema,
        tag: 'Employee Credential',
        supportRevocation: false,
      },
      {
        // Need to pass this as the indy-sdk MUST have the seqNo
        indyLedgerSchemaSeqNo: schemaMetadata.indyLedgerSeqNo as number,
      }
    )

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

    const cd = parseCredentialDefinitionId(credentialDefinitionState.credentialDefinitionId)
    const legacyCredentialDefinitionId = getLegacyCredentialDefinitionId(cd.namespaceIdentifier, cd.schemaSeqNo, cd.tag)

    const s = parseSchemaId(schemaState.schemaId)
    const legacySchemaId = getLegacySchemaId(s.namespaceIdentifier, s.schemaName, s.schemaVersion)

    // Holder creates proposal
    holderCredentialRecord.credentialAttributes = credentialAttributes
    const { attachment: proposalAttachment } = await indyCredentialFormatService.createProposal(agentContext, {
      credentialRecord: holderCredentialRecord,
      credentialFormats: {
        indy: {
          attributes: credentialAttributes,
          credentialDefinitionId: legacyCredentialDefinitionId,
        },
      },
    })

    // Issuer processes and accepts proposal
    await indyCredentialFormatService.processProposal(agentContext, {
      credentialRecord: issuerCredentialRecord,
      attachment: proposalAttachment,
    })
    // Set attributes on the credential record, this is normally done by the protocol service
    issuerCredentialRecord.credentialAttributes = credentialAttributes
    const { attachment: offerAttachment } = await indyCredentialFormatService.acceptProposal(agentContext, {
      credentialRecord: issuerCredentialRecord,
      proposalAttachment: proposalAttachment,
    })

    // Holder processes and accepts offer
    await indyCredentialFormatService.processOffer(agentContext, {
      credentialRecord: holderCredentialRecord,
      attachment: offerAttachment,
    })
    const { attachment: requestAttachment } = await indyCredentialFormatService.acceptOffer(agentContext, {
      credentialRecord: holderCredentialRecord,
      offerAttachment,
    })

    // Make sure the request contains a prover_did field
    expect((requestAttachment.getDataAsJson() as AnonCredsCredentialRequest).prover_did).toBeDefined()

    // Issuer processes and accepts request
    await indyCredentialFormatService.processRequest(agentContext, {
      credentialRecord: issuerCredentialRecord,
      attachment: requestAttachment,
    })
    const { attachment: credentialAttachment } = await indyCredentialFormatService.acceptRequest(agentContext, {
      credentialRecord: issuerCredentialRecord,
      requestAttachment,
      offerAttachment,
    })

    // Holder processes and accepts credential
    await indyCredentialFormatService.processCredential(agentContext, {
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
      schemaId: legacySchemaId,
      credentialDefinitionId: legacyCredentialDefinitionId,
      revocationRegistryId: null,
      credentialRevocationId: null,
    })

    expect(holderCredentialRecord.metadata.data).toEqual({
      '_anonCreds/anonCredsCredential': {
        schemaId: legacySchemaId,
        credentialDefinitionId: legacyCredentialDefinitionId,
      },
      '_anonCreds/anonCredsCredentialRequest': {
        master_secret_blinding_data: expect.any(Object),
        master_secret_name: expect.any(String),
        nonce: expect.any(String),
      },
    })

    expect(issuerCredentialRecord.metadata.data).toEqual({
      '_anonCreds/anonCredsCredential': {
        schemaId: legacySchemaId,
        credentialDefinitionId: legacyCredentialDefinitionId,
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

    const { attachment: proofProposalAttachment } = await indyProofFormatService.createProposal(agentContext, {
      proofFormats: {
        indy: {
          attributes: [
            {
              name: 'name',
              credentialDefinitionId: legacyCredentialDefinitionId,
              value: 'John',
              referent: '1',
            },
          ],
          predicates: [
            {
              credentialDefinitionId: legacyCredentialDefinitionId,
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

    await indyProofFormatService.processProposal(agentContext, {
      attachment: proofProposalAttachment,
      proofRecord: verifierProofRecord,
    })

    const { attachment: proofRequestAttachment } = await indyProofFormatService.acceptProposal(agentContext, {
      proofRecord: verifierProofRecord,
      proposalAttachment: proofProposalAttachment,
    })

    await indyProofFormatService.processRequest(agentContext, {
      attachment: proofRequestAttachment,
      proofRecord: holderProofRecord,
    })

    const { attachment: proofAttachment } = await indyProofFormatService.acceptRequest(agentContext, {
      proofRecord: holderProofRecord,
      requestAttachment: proofRequestAttachment,
      proposalAttachment: proofProposalAttachment,
    })

    const isValid = await indyProofFormatService.processPresentation(agentContext, {
      attachment: proofAttachment,
      proofRecord: verifierProofRecord,
      requestAttachment: proofRequestAttachment,
    })

    expect(isValid).toBe(true)
  })
})
