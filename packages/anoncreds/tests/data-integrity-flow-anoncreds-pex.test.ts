import type { EventReplaySubject } from '../../core/tests'
import type { AnonCredsTestsAgent } from './anoncredsSetup'

import { W3cCredential, W3cCredentialService, W3cCredentialSubject } from '@credo-ts/core'
import {
  DidCommAutoAcceptCredential,
  DidCommCredentialExchangeRecord,
  DidCommCredentialState,
  DidCommProofState,
} from '@credo-ts/didcomm'

import {
  createDidKidVerificationMethod,
  waitForCredentialRecordSubject,
  waitForProofExchangeRecord,
} from '../../core/tests'

import { InMemoryAnonCredsRegistry } from './InMemoryAnonCredsRegistry'
import { setupAnonCredsTests } from './anoncredsSetup'
import { presentationDefinition } from './fixtures/presentation-definition'

const issuerId = 'did:indy:local:LjgpST2rjsoxYegQDRm7EL'

describe('anoncreds w3c data integrity tests', () => {
  let issuerAgent: AnonCredsTestsAgent
  let holderAgent: AnonCredsTestsAgent
  let credentialDefinitionId: string
  let issuerHolderConnectionId: string
  let holderIssuerConnectionId: string
  let revocationRegistryDefinitionId: string | null

  let issuerReplay: EventReplaySubject
  let holderReplay: EventReplaySubject

  const inMemoryRegistry = new InMemoryAnonCredsRegistry()

  afterEach(async () => {
    await issuerAgent.shutdown()
    await holderAgent.shutdown()
  })

  test('issuance and verification flow starting from offer with revocation', async () => {
    ;({
      issuerAgent,
      issuerReplay,
      holderAgent,
      holderReplay,
      credentialDefinitionId,
      issuerHolderConnectionId,
      revocationRegistryDefinitionId,
      holderIssuerConnectionId,
    } = await setupAnonCredsTests({
      issuerId: 'did:indy:local:LjgpST2rjsoxYegQDRm7EL',
      issuerName: 'Faber Agent Credentials v2',
      holderName: 'Alice Agent Credentials v2',
      attributeNames: ['id', 'name', 'height', 'age'],
      registries: [inMemoryRegistry],
      supportRevocation: true,
    }))
    await anonCredsFlowTest({
      credentialDefinitionId,
      issuerHolderConnectionId,
      revocationRegistryDefinitionId,
      holderIssuerConnectionId,
      issuerReplay: issuerReplay,
      holderReplay: holderReplay,
      issuer: issuerAgent,
      holder: holderAgent,
    })
  })

  test('issuance and verification flow starting from offer without revocation', async () => {
    ;({
      issuerAgent,
      issuerReplay,
      holderAgent,
      holderReplay,
      credentialDefinitionId,
      issuerHolderConnectionId,
      revocationRegistryDefinitionId,
      holderIssuerConnectionId,
    } = await setupAnonCredsTests({
      issuerId: 'did:indy:local:LjgpST2rjsoxYegQDRm7EL',
      issuerName: 'Faber Agent Credentials v2',
      holderName: 'Alice Agent Credentials v2',
      attributeNames: ['id', 'name', 'height', 'age'],
      registries: [inMemoryRegistry],
      supportRevocation: false,
    }))
    await anonCredsFlowTest({
      credentialDefinitionId,
      issuerHolderConnectionId,
      holderIssuerConnectionId,
      issuerReplay,
      holderReplay,
      revocationRegistryDefinitionId,
      issuer: issuerAgent,
      holder: holderAgent,
    })
  })
})

async function anonCredsFlowTest(options: {
  issuer: AnonCredsTestsAgent
  holder: AnonCredsTestsAgent
  issuerHolderConnectionId: string
  holderIssuerConnectionId: string
  issuerReplay: EventReplaySubject
  holderReplay: EventReplaySubject
  revocationRegistryDefinitionId: string | null
  credentialDefinitionId: string
}) {
  const {
    credentialDefinitionId,
    issuerHolderConnectionId,
    holderIssuerConnectionId,
    issuer,
    revocationRegistryDefinitionId,
    holder,
    issuerReplay,
    holderReplay,
  } = options

  const holderKdv = await createDidKidVerificationMethod(holder.context, '96213c3d7fc8d4d6754c7a0fd969598f')
  const linkSecret = await holder.modules.anoncreds.createLinkSecret({ linkSecretId: 'linkSecretId' })
  expect(linkSecret).toBe('linkSecretId')

  const credential = new W3cCredential({
    context: [
      'https://www.w3.org/2018/credentials/v1',
      'https://w3id.org/security/data-integrity/v2',
      {
        '@vocab': 'https://www.w3.org/ns/credentials/issuer-dependent#',
      },
    ],
    type: ['VerifiableCredential'],
    issuer: issuerId,
    issuanceDate: new Date().toISOString(),
    credentialSubject: new W3cCredentialSubject({
      id: holderKdv.did,
      claims: { name: 'John', age: '25', height: 173 },
    }),
  })

  // issuer offers credential
  let issuerRecord = await issuer.modules.credentials.offerCredential({
    protocolVersion: 'v2',
    autoAcceptCredential: DidCommAutoAcceptCredential.Never,
    connectionId: issuerHolderConnectionId,
    credentialFormats: {
      dataIntegrity: {
        bindingRequired: true,
        credential,
        anonCredsLinkSecretBinding: {
          credentialDefinitionId,
          revocationRegistryDefinitionId: revocationRegistryDefinitionId ?? undefined,
          revocationRegistryIndex: revocationRegistryDefinitionId ? 1 : undefined,
        },
        didCommSignedAttachmentBinding: {},
      },
    },
  })

  // Holder processes and accepts offer
  let holderRecord = await waitForCredentialRecordSubject(holderReplay, {
    state: DidCommCredentialState.OfferReceived,
    threadId: issuerRecord.threadId,
  })
  holderRecord = await holder.modules.credentials.acceptOffer({
    credentialExchangeRecordId: holderRecord.id,
    autoAcceptCredential: DidCommAutoAcceptCredential.Never,
    credentialFormats: {
      dataIntegrity: {
        anonCredsLinkSecret: {
          linkSecretId: 'linkSecretId',
        },
      },
    },
  })

  // issuer receives request and accepts
  issuerRecord = await waitForCredentialRecordSubject(issuerReplay, {
    state: DidCommCredentialState.RequestReceived,
    threadId: holderRecord.threadId,
  })
  issuerRecord = await issuer.modules.credentials.acceptRequest({
    credentialExchangeRecordId: issuerRecord.id,
    autoAcceptCredential: DidCommAutoAcceptCredential.Never,
    credentialFormats: {
      dataIntegrity: {},
    },
  })

  holderRecord = await waitForCredentialRecordSubject(holderReplay, {
    state: DidCommCredentialState.CredentialReceived,
    threadId: issuerRecord.threadId,
  })
  holderRecord = await holder.modules.credentials.acceptCredential({
    credentialExchangeRecordId: holderRecord.id,
  })

  issuerRecord = await waitForCredentialRecordSubject(issuerReplay, {
    state: DidCommCredentialState.Done,
    threadId: holderRecord.threadId,
  })

  expect(holderRecord).toMatchObject({
    type: DidCommCredentialExchangeRecord.type,
    id: expect.any(String),
    createdAt: expect.any(Date),
    metadata: {
      data: {
        '_anoncreds/credential': {
          credentialDefinitionId,
          schemaId: expect.any(String),
        },
        '_anoncreds/credentialRequest': {
          link_secret_blinding_data: {
            v_prime: expect.any(String),
            vr_prime: revocationRegistryDefinitionId ? expect.any(String) : null,
          },
          nonce: expect.any(String),
          link_secret_name: 'linkSecretId',
        },
      },
    },
    state: DidCommCredentialState.Done,
  })

  const tags = holderRecord.getTags()
  expect(tags.credentialIds).toHaveLength(1)

  await expect(
    holder.dependencyManager
      .resolve(W3cCredentialService)
      .getCredentialRecordById(holder.context, tags.credentialIds[0])
  ).resolves

  let issuerProofExchangeRecordPromise = waitForProofExchangeRecord(issuer, {
    state: DidCommProofState.ProposalReceived,
  })

  const pdCopy = JSON.parse(JSON.stringify(presentationDefinition))
  if (!revocationRegistryDefinitionId) {
    for (const ide of pdCopy.input_descriptors) {
      // biome-ignore lint/performance/noDelete: <explanation>
      delete ide.constraints?.statuses
    }
  }

  let holderProofExchangeRecord = await holder.modules.proofs.proposeProof({
    protocolVersion: 'v2',
    connectionId: holderIssuerConnectionId,
    proofFormats: {
      presentationExchange: {
        presentationDefinition: pdCopy,
      },
    },
  })

  let issuerProofExchangeRecord = await issuerProofExchangeRecordPromise

  let holderProofExchangeRecordPromise = waitForProofExchangeRecord(holder, {
    state: DidCommProofState.RequestReceived,
  })

  issuerProofExchangeRecord = await issuer.modules.proofs.acceptProposal({
    proofExchangeRecordId: issuerProofExchangeRecord.id,
  })

  holderProofExchangeRecord = await holderProofExchangeRecordPromise

  const requestedCredentials = await holder.modules.proofs.selectCredentialsForRequest({
    proofExchangeRecordId: holderProofExchangeRecord.id,
  })

  const selectedCredentials = requestedCredentials.proofFormats.presentationExchange?.credentials
  if (!selectedCredentials) {
    throw new Error('No credentials found for presentation exchange')
  }

  issuerProofExchangeRecordPromise = waitForProofExchangeRecord(issuer, {
    threadId: holderProofExchangeRecord.threadId,
    state: DidCommProofState.PresentationReceived,
  })

  await holder.modules.proofs.acceptRequest({
    proofExchangeRecordId: holderProofExchangeRecord.id,
    proofFormats: {
      presentationExchange: {
        credentials: selectedCredentials,
      },
    },
  })
  issuerProofExchangeRecord = await issuerProofExchangeRecordPromise

  holderProofExchangeRecordPromise = waitForProofExchangeRecord(holder, {
    threadId: holderProofExchangeRecord.threadId,
    state: DidCommProofState.Done,
  })

  await issuer.modules.proofs.acceptPresentation({ proofExchangeRecordId: issuerProofExchangeRecord.id })

  holderProofExchangeRecord = await holderProofExchangeRecordPromise
}
