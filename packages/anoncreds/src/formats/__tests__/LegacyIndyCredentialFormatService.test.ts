import {
  CredentialState,
  CredentialExchangeRecord,
  SigningProviderRegistry,
  KeyType,
  CredentialPreviewAttribute,
} from '@aries-framework/core'
import * as indySdk from 'indy-sdk'

import { getAgentConfig, getAgentContext } from '../../../../core/tests/helpers'
import {
  IndySdkHolderService,
  IndySdkIssuerService,
  IndySdkVerifierService,
  IndySdkWallet,
} from '../../../../indy-sdk/src'
import { IndySdkRevocationService } from '../../../../indy-sdk/src/anoncreds/services/IndySdkRevocationService'
import { indyDidFromPublicKeyBase58 } from '../../../../indy-sdk/src/utils/did'
import { InMemoryAnonCredsRegistry } from '../../../tests/InMemoryAnonCredsRegistry'
import { AnonCredsModuleConfig } from '../../AnonCredsModuleConfig'
import {
  AnonCredsHolderServiceSymbol,
  AnonCredsIssuerServiceSymbol,
  AnonCredsVerifierServiceSymbol,
} from '../../services'
import { AnonCredsRegistryService } from '../../services/registry/AnonCredsRegistryService'
import { LegacyIndyCredentialFormatService } from '../LegacyIndyCredentialFormatService'

const registry = new InMemoryAnonCredsRegistry()
const anonCredsModuleConfig = new AnonCredsModuleConfig({
  registries: [registry],
})

const agentConfig = getAgentConfig('LegacyIndyCredentialFormatServiceTest')
const anonCredsRevocationService = new IndySdkRevocationService(indySdk)
const anonCredsVerifierService = new IndySdkVerifierService(indySdk)
const anonCredsHolderService = new IndySdkHolderService(anonCredsRevocationService, indySdk)
const anonCredsIssuerService = new IndySdkIssuerService(indySdk)
const wallet = new IndySdkWallet(indySdk, agentConfig.logger, new SigningProviderRegistry([]))
const agentContext = getAgentContext({
  registerInstances: [
    [AnonCredsIssuerServiceSymbol, anonCredsIssuerService],
    [AnonCredsHolderServiceSymbol, anonCredsHolderService],
    [AnonCredsVerifierServiceSymbol, anonCredsVerifierService],
    [AnonCredsRegistryService, new AnonCredsRegistryService()],
    [AnonCredsModuleConfig, anonCredsModuleConfig],
  ],
  agentConfig,
  wallet,
})

const indyCredentialFormatService = new LegacyIndyCredentialFormatService()

describe('LegacyIndyCredentialFormatService', () => {
  beforeEach(async () => {
    await wallet.createAndOpen(agentConfig.walletConfig)
  })

  afterEach(async () => {
    await wallet.delete()
  })

  test('issuance flow starting from proposal without negotiation and without revocation', async () => {
    // This is just so we don't have to register an actually indy did (as we don't have the indy did registrar configured)
    const key = await wallet.createKey({ keyType: KeyType.Ed25519 })
    const indyDid = indyDidFromPublicKeyBase58(key.publicKeyBase58)

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

    // Holder creates proposal
    holderCredentialRecord.credentialAttributes = credentialAttributes
    const { attachment: proposalAttachment } = await indyCredentialFormatService.createProposal(agentContext, {
      credentialRecord: holderCredentialRecord,
      credentialFormats: {
        indy: {
          attributes: credentialAttributes,
          credentialDefinitionId: credentialDefinitionState.credentialDefinitionId,
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
      schemaId: schemaState.schemaId,
      credentialDefinitionId: credentialDefinitionState.credentialDefinitionId,
      revocationRegistryId: null,
      credentialRevocationId: null,
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
