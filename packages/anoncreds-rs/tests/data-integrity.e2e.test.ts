import type { AnonCredsTestsAgent } from './anoncredsSetup'
import type { AgentContext, KeyDidCreateOptions } from '@aries-framework/core'
import type { EventReplaySubject } from '@aries-framework/core/tests'
import type { InputDescriptorV2, PresentationDefinitionV1 } from '@sphereon/pex-models'

import {
  AutoAcceptCredential,
  CredentialExchangeRecord,
  CredentialState,
  DidKey,
  DidsApi,
  KeyType,
  ProofState,
  TypedArrayEncoder,
  W3cCredential,
  W3cCredentialService,
  W3cCredentialSubject,
} from '@aries-framework/core'

import { InMemoryAnonCredsRegistry } from '../../anoncreds/tests/InMemoryAnonCredsRegistry'
import { waitForCredentialRecordSubject, waitForProofExchangeRecord } from '../../core/tests/helpers'

import { setupAnonCredsTests } from './anoncredsSetup'
import { presentationDefinition } from './fixtures/presentation-definition'

export async function createDidKidVerificationMethod(agentContext: AgentContext, secretKey: string) {
  const dids = agentContext.dependencyManager.resolve(DidsApi)
  const didCreateResult = await dids.create<KeyDidCreateOptions>({
    method: 'key',
    options: { keyType: KeyType.Ed25519 },
    secret: { privateKey: TypedArrayEncoder.fromString(secretKey) },
  })

  const did = didCreateResult.didState.did as string
  const didKey = DidKey.fromDid(did)
  const kid = `${did}#${didKey.key.fingerprint}`

  const verificationMethod = didCreateResult.didState.didDocument?.dereferenceKey(kid, ['authentication'])
  if (!verificationMethod) throw new Error('No verification method found')

  return { did, kid, verificationMethod }
}

const issuerId = 'did:indy:local:LjgpST2rjsoxYegQDRm7EL'
export type KDV = Awaited<ReturnType<typeof createDidKidVerificationMethod>>

describe('data anoncreds w3c data integrity e2e tests', () => {
  let issuerAgent: AnonCredsTestsAgent
  let holderAgent: AnonCredsTestsAgent
  let credentialDefinitionId: string
  let issuerHolderConnectionId: string
  let holderIssuerConnectionId: string
  let revocationRegistryDefinitionId: string | undefined

  let issuerReplay: EventReplaySubject
  let holderReplay: EventReplaySubject

  const inMemoryRegistry = new InMemoryAnonCredsRegistry()

  afterEach(async () => {
    await issuerAgent.shutdown()
    await issuerAgent.wallet.delete()
    await holderAgent.shutdown()
    await holderAgent.wallet.delete()
  })

  test('issuance and verification flow starting from proposal without negotiation and with revocation', async () => {
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

  test('issuance and verification flow starting from proposal without negotiation and without revocation', async () => {
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
  revocationRegistryDefinitionId: string | undefined
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
  let issuerRecord = await issuer.credentials.offerCredential({
    protocolVersion: 'v2',
    autoAcceptCredential: AutoAcceptCredential.Never,
    connectionId: issuerHolderConnectionId,
    credentialFormats: {
      dataIntegrity: {
        bindingRequired: true,
        credential,
        anonCredsLinkSecretBindingMethodOptions: {
          credentialDefinitionId,
          revocationRegistryDefinitionId,
          revocationRegistryIndex: revocationRegistryDefinitionId ? 1 : undefined,
        },
        didCommSignedAttachmentBindingMethodOptions: {},
      },
    },
  })

  // Holder processes and accepts offer
  let holderRecord = await waitForCredentialRecordSubject(holderReplay, {
    state: CredentialState.OfferReceived,
    threadId: issuerRecord.threadId,
  })
  holderRecord = await holder.credentials.acceptOffer({
    credentialRecordId: holderRecord.id,
    autoAcceptCredential: AutoAcceptCredential.Never,
    credentialFormats: {
      dataIntegrity: {
        anonCredsLinkSecretCredentialRequestOptions: {
          linkSecretId: 'linkSecretId',
        },
        //        didCommSignedAttachmentCredentialRequestOptions: {
        //          kid: holderKdv.kid,
        //        },
      },
    },
  })

  // issuer receives request and accepts
  issuerRecord = await waitForCredentialRecordSubject(issuerReplay, {
    state: CredentialState.RequestReceived,
    threadId: holderRecord.threadId,
  })
  issuerRecord = await issuer.credentials.acceptRequest({
    credentialRecordId: issuerRecord.id,
    autoAcceptCredential: AutoAcceptCredential.Never,
    credentialFormats: {
      dataIntegrity: {},
    },
  })

  holderRecord = await waitForCredentialRecordSubject(holderReplay, {
    state: CredentialState.CredentialReceived,
    threadId: issuerRecord.threadId,
  })
  holderRecord = await holder.credentials.acceptCredential({
    credentialRecordId: holderRecord.id,
  })

  issuerRecord = await waitForCredentialRecordSubject(issuerReplay, {
    state: CredentialState.Done,
    threadId: holderRecord.threadId,
  })

  expect(holderRecord).toMatchObject({
    type: CredentialExchangeRecord.type,
    id: expect.any(String),
    createdAt: expect.any(Date),
    metadata: {
      data: {
        '_dataIntegrity/credential': {
          linkSecretMetadata: {
            credentialDefinitionId,
            schemaId: expect.any(String),
          },
        },
        '_dataIntegrity/credentialRequest': {
          linkSecretRequestMetadata: {
            link_secret_blinding_data: {
              v_prime: expect.any(String),
              vr_prime: revocationRegistryDefinitionId ? expect.any(String) : null,
            },
            nonce: expect.any(String),
            link_secret_name: 'linkSecretId',
          },
        },
      },
    },
    state: CredentialState.Done,
  })

  const tags = holderRecord.getTags()
  expect(tags.credentialIds).toHaveLength(1)

  await expect(
    holder.dependencyManager
      .resolve(W3cCredentialService)
      .getCredentialRecordById(holder.context, tags.credentialIds[0])
  ).resolves

  let issuerProofExchangeRecordPromise = waitForProofExchangeRecord(issuer, {
    state: ProofState.ProposalReceived,
  })

  const pdCopy: PresentationDefinitionV1 = JSON.parse(JSON.stringify(presentationDefinition))
  if (!revocationRegistryDefinitionId)
    pdCopy.input_descriptors.forEach((ide: InputDescriptorV2) => delete ide.constraints?.statuses)

  let holderProofExchangeRecord = await holder.proofs.proposeProof({
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
    state: ProofState.RequestReceived,
  })

  issuerProofExchangeRecord = await issuer.proofs.acceptProposal({
    proofRecordId: issuerProofExchangeRecord.id,
  })

  holderProofExchangeRecord = await holderProofExchangeRecordPromise

  const requestedCredentials = await holder.proofs.selectCredentialsForRequest({
    proofRecordId: holderProofExchangeRecord.id,
  })

  const selectedCredentials = requestedCredentials.proofFormats.presentationExchange?.credentials
  if (!selectedCredentials) {
    throw new Error('No credentials found for presentation exchange')
  }

  issuerProofExchangeRecordPromise = waitForProofExchangeRecord(issuer, {
    threadId: holderProofExchangeRecord.threadId,
    state: ProofState.PresentationReceived,
  })

  await holder.proofs.acceptRequest({
    proofRecordId: holderProofExchangeRecord.id,
    proofFormats: {
      presentationExchange: {
        credentials: selectedCredentials,
      },
    },
  })
  issuerProofExchangeRecord = await issuerProofExchangeRecordPromise

  holderProofExchangeRecordPromise = waitForProofExchangeRecord(holder, {
    threadId: holderProofExchangeRecord.threadId,
    state: ProofState.Done,
  })

  await issuer.proofs.acceptPresentation({ proofRecordId: issuerProofExchangeRecord.id })

  holderProofExchangeRecord = await holderProofExchangeRecordPromise
}
