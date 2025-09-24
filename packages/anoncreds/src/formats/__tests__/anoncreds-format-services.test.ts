import type { DidRepository } from '@credo-ts/core'
import {
  CacheModuleConfig,
  DidResolverService,
  DidsModuleConfig,
  EventEmitter,
  InMemoryLruCache,
  InjectionSymbols,
  Kms,
  SignatureSuiteToken,
  TypedArrayEncoder,
  W3cCredentialsModuleConfig,
} from '@credo-ts/core'
import {
  DidCommCredentialExchangeRecord,
  DidCommCredentialPreviewAttribute,
  DidCommCredentialRole,
  DidCommCredentialState,
  DidCommProofExchangeRecord,
  DidCommProofRole,
  DidCommProofState,
} from '@credo-ts/didcomm'
import { Subject } from 'rxjs'
import type { AnonCredsCredentialRequest } from '../../models'

import { InMemoryStorageService } from '../../../../../tests/InMemoryStorageService'
import { anoncreds } from '../../../../anoncreds/tests/helpers'
import { indyDidFromPublicKeyBase58 } from '../../../../core/src/utils/did'
import { testLogger } from '../../../../core/tests'
import { agentDependencies, getAgentConfig, getAgentContext } from '../../../../core/tests/helpers'
import { InMemoryAnonCredsRegistry } from '../../../tests/InMemoryAnonCredsRegistry'
import { AnonCredsModuleConfig } from '../../AnonCredsModuleConfig'
import { AnonCredsRsHolderService, AnonCredsRsIssuerService, AnonCredsRsVerifierService } from '../../anoncreds-rs'
import {
  AnonCredsCredentialDefinitionPrivateRecord,
  AnonCredsCredentialDefinitionPrivateRepository,
  AnonCredsCredentialDefinitionRecord,
  AnonCredsCredentialDefinitionRepository,
  AnonCredsCredentialRepository,
  AnonCredsKeyCorrectnessProofRecord,
  AnonCredsKeyCorrectnessProofRepository,
  AnonCredsLinkSecretRecord,
  AnonCredsLinkSecretRepository,
} from '../../repository'
import {
  AnonCredsHolderServiceSymbol,
  AnonCredsIssuerServiceSymbol,
  AnonCredsVerifierServiceSymbol,
} from '../../services'
import { AnonCredsRegistryService } from '../../services/registry/AnonCredsRegistryService'
import { getUnqualifiedCredentialDefinitionId, parseIndyCredentialDefinitionId } from '../../utils/indyIdentifiers'
import { AnonCredsCredentialFormatService } from '../AnonCredsCredentialFormatService'
import { AnonCredsDidCommProofFormatService } from '../AnonCredsDidCommProofFormatService'

const registry = new InMemoryAnonCredsRegistry()
const anonCredsModuleConfig = new AnonCredsModuleConfig({
  registries: [registry],
  anoncreds,
  autoCreateLinkSecret: false,
})

const agentConfig = getAgentConfig('AnoncredsFormatServicesTest')
const anonCredsVerifierService = new AnonCredsRsVerifierService()
const anonCredsHolderService = new AnonCredsRsHolderService()
const anonCredsIssuerService = new AnonCredsRsIssuerService()

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const storageService = new InMemoryStorageService<any>()
const eventEmitter = new EventEmitter(agentDependencies, new Subject())
const anonCredsLinkSecretRepository = new AnonCredsLinkSecretRepository(storageService, eventEmitter)
const anonCredsCredentialDefinitionRepository = new AnonCredsCredentialDefinitionRepository(
  storageService,
  eventEmitter
)
const anonCredsCredentialDefinitionPrivateRepository = new AnonCredsCredentialDefinitionPrivateRepository(
  storageService,
  eventEmitter
)

const inMemoryStorageService = new InMemoryStorageService()
const anonCredsCredentialRepository = new AnonCredsCredentialRepository(storageService, eventEmitter)
const anonCredsKeyCorrectnessProofRepository = new AnonCredsKeyCorrectnessProofRepository(storageService, eventEmitter)
const agentContext = getAgentContext({
  registerInstances: [
    [InjectionSymbols.Stop$, new Subject<boolean>()],
    [InjectionSymbols.AgentDependencies, agentDependencies],
    [InjectionSymbols.FileSystem, new agentDependencies.FileSystem()],
    [InjectionSymbols.StorageService, inMemoryStorageService],
    [InjectionSymbols.Logger, testLogger],
    [AnonCredsIssuerServiceSymbol, anonCredsIssuerService],
    [AnonCredsHolderServiceSymbol, anonCredsHolderService],
    [AnonCredsVerifierServiceSymbol, anonCredsVerifierService],
    [DidResolverService, new DidResolverService(testLogger, new DidsModuleConfig(), {} as unknown as DidRepository)],
    [AnonCredsRegistryService, new AnonCredsRegistryService()],
    [AnonCredsModuleConfig, anonCredsModuleConfig],
    [AnonCredsLinkSecretRepository, anonCredsLinkSecretRepository],
    [AnonCredsCredentialDefinitionRepository, anonCredsCredentialDefinitionRepository],
    [AnonCredsCredentialDefinitionPrivateRepository, anonCredsCredentialDefinitionPrivateRepository],
    [AnonCredsCredentialRepository, anonCredsCredentialRepository],
    [AnonCredsKeyCorrectnessProofRepository, anonCredsKeyCorrectnessProofRepository],
    [W3cCredentialsModuleConfig, new W3cCredentialsModuleConfig()],
    [InjectionSymbols.StorageService, storageService],
    [SignatureSuiteToken, 'default'],
    [
      CacheModuleConfig,
      new CacheModuleConfig({
        cache: new InMemoryLruCache({ limit: 500 }),
      }),
    ],
  ],
  agentConfig,
})

const anoncredsCredentialFormatService = new AnonCredsCredentialFormatService()
const anoncredsProofFormatService = new AnonCredsDidCommProofFormatService()
const kms = agentContext.resolve(Kms.KeyManagementApi)

describe('Anoncreds format services', () => {
  test('legacy unqualified did (sov or indy) issuance and verification flow starting from proposal without negotiation and without revocation', async () => {
    // This is just so we don't have to register an actual indy did (as we don't have the indy did registrar configured)
    const key = await kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
    const unqualifiedIndyDid = indyDidFromPublicKeyBase58(
      TypedArrayEncoder.toBase58(Kms.PublicJwk.fromPublicJwk(key.publicJwk).publicKey.publicKey)
    )
    const indyDid = `did:indy:pool1:${unqualifiedIndyDid}`

    // Create link secret
    const { linkSecretValue } = await anonCredsHolderService.createLinkSecret(agentContext, {
      linkSecretId: 'link-secret-id',
    })
    const anonCredsLinkSecret = new AnonCredsLinkSecretRecord({
      linkSecretId: 'link-secret-id',
      value: linkSecretValue,
    })
    anonCredsLinkSecret.setTag('isDefault', true)
    await anonCredsLinkSecretRepository.save(agentContext, anonCredsLinkSecret)

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

    await anonCredsCredentialDefinitionRepository.save(
      agentContext,
      new AnonCredsCredentialDefinitionRecord({
        credentialDefinition,
        credentialDefinitionId: credentialDefinitionState.credentialDefinitionId,
        methodName: 'indy',
      })
    )

    if (!keyCorrectnessProof || !credentialDefinitionPrivate) {
      throw new Error('Failed to create credential definition private or key correctness proof')
    }

    await anonCredsKeyCorrectnessProofRepository.save(
      agentContext,
      new AnonCredsKeyCorrectnessProofRecord({
        credentialDefinitionId: credentialDefinitionState.credentialDefinitionId,
        value: keyCorrectnessProof,
      })
    )

    await anonCredsCredentialDefinitionPrivateRepository.save(
      agentContext,
      new AnonCredsCredentialDefinitionPrivateRecord({
        credentialDefinitionId: credentialDefinitionState.credentialDefinitionId,
        value: credentialDefinitionPrivate,
      })
    )

    const holderCredentialRecord = new DidCommCredentialExchangeRecord({
      protocolVersion: 'v2',
      state: DidCommCredentialState.ProposalSent,
      role: DidCommCredentialRole.Holder,
      threadId: 'f365c1a5-2baf-4873-9432-fa87c888a0aa',
    })

    const issuerCredentialRecord = new DidCommCredentialExchangeRecord({
      protocolVersion: 'v2',
      state: DidCommCredentialState.ProposalReceived,
      role: DidCommCredentialRole.Issuer,
      threadId: 'f365c1a5-2baf-4873-9432-fa87c888a0aa',
    })

    const credentialAttributes = [
      new DidCommCredentialPreviewAttribute({
        name: 'name',
        value: 'John',
      }),
      new DidCommCredentialPreviewAttribute({
        name: 'age',
        value: '25',
      }),
    ]

    // Holder creates proposal
    holderCredentialRecord.credentialAttributes = credentialAttributes
    const { attachment: proposalAttachment } = await anoncredsCredentialFormatService.createProposal(agentContext, {
      credentialExchangeRecord: holderCredentialRecord,
      credentialFormats: {
        anoncreds: {
          attributes: credentialAttributes,
          credentialDefinitionId: credentialDefinitionState.credentialDefinitionId,
        },
      },
    })

    // Issuer processes and accepts proposal
    await anoncredsCredentialFormatService.processProposal(agentContext, {
      credentialExchangeRecord: issuerCredentialRecord,
      attachment: proposalAttachment,
    })
    // Set attributes on the credential record, this is normally done by the protocol service
    issuerCredentialRecord.credentialAttributes = credentialAttributes
    const { attachment: offerAttachment } = await anoncredsCredentialFormatService.acceptProposal(agentContext, {
      credentialExchangeRecord: issuerCredentialRecord,
      proposalAttachment: proposalAttachment,
    })

    // Holder processes and accepts offer
    await anoncredsCredentialFormatService.processOffer(agentContext, {
      credentialExchangeRecord: holderCredentialRecord,
      attachment: offerAttachment,
    })
    const { attachment: requestAttachment } = await anoncredsCredentialFormatService.acceptOffer(agentContext, {
      credentialExchangeRecord: holderCredentialRecord,
      offerAttachment,
    })

    // Make sure the request contains a entropy field
    expect((requestAttachment.getDataAsJson() as AnonCredsCredentialRequest).entropy).toBeDefined()

    // Issuer processes and accepts request
    await anoncredsCredentialFormatService.processRequest(agentContext, {
      credentialExchangeRecord: issuerCredentialRecord,
      attachment: requestAttachment,
    })
    const { attachment: credentialAttachment } = await anoncredsCredentialFormatService.acceptRequest(agentContext, {
      credentialExchangeRecord: issuerCredentialRecord,
      requestAttachment,
      offerAttachment,
    })

    // Holder processes and accepts credential
    await anoncredsCredentialFormatService.processCredential(agentContext, {
      offerAttachment,
      credentialExchangeRecord: holderCredentialRecord,
      attachment: credentialAttachment,
      requestAttachment,
    })

    expect(holderCredentialRecord.credentials).toEqual([
      { credentialRecordType: 'w3c', credentialRecordId: expect.any(String) },
    ])

    const credentialId = holderCredentialRecord.credentials[0].credentialRecordId
    const anonCredsCredential = await anonCredsHolderService.getCredential(agentContext, {
      id: credentialId,
    })

    expect(anonCredsCredential).toEqual({
      credentialId,
      attributes: {
        age: 25,
        name: 'John',
      },
      schemaId: schemaState.schemaId,
      linkSecretId: 'link-secret-id',
      credentialDefinitionId: credentialDefinitionState.credentialDefinitionId,
      revocationRegistryId: null,
      credentialRevocationId: null,
      methodName: 'inMemory',
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    })

    expect(holderCredentialRecord.metadata.data).toEqual({
      '_anoncreds/credential': {
        schemaId: schemaState.schemaId,
        credentialDefinitionId: credentialDefinitionState.credentialDefinitionId,
      },
      '_anoncreds/credentialRequest': {
        link_secret_blinding_data: expect.any(Object),
        link_secret_name: expect.any(String),
        nonce: expect.any(String),
      },
    })

    expect(issuerCredentialRecord.metadata.data).toEqual({
      '_anoncreds/credential': {
        schemaId: schemaState.schemaId,
        credentialDefinitionId: credentialDefinitionState.credentialDefinitionId,
      },
    })

    const holderProofRecord = new DidCommProofExchangeRecord({
      protocolVersion: 'v2',
      state: DidCommProofState.ProposalSent,
      role: DidCommProofRole.Prover,
      threadId: '4f5659a4-1aea-4f42-8c22-9a9985b35e38',
    })
    const verifierProofRecord = new DidCommProofExchangeRecord({
      protocolVersion: 'v2',
      state: DidCommProofState.ProposalReceived,
      role: DidCommProofRole.Verifier,
      threadId: '4f5659a4-1aea-4f42-8c22-9a9985b35e38',
    })

    const cd = parseIndyCredentialDefinitionId(credentialDefinitionState.credentialDefinitionId)
    const legacyCredentialDefinitionId = getUnqualifiedCredentialDefinitionId(
      cd.namespaceIdentifier,
      cd.schemaSeqNo,
      cd.tag
    )

    const { attachment: proofProposalAttachment } = await anoncredsProofFormatService.createProposal(agentContext, {
      proofFormats: {
        anoncreds: {
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
