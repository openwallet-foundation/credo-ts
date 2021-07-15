import type { SubjectMessage } from '../../../tests/transport/SubjectInboundTransport'
import type { ConnectionRecord } from '../src/modules/connections'
import type { CredDefId } from 'indy-sdk'

import { Subject } from 'rxjs'

import { SubjectInboundTransporter } from '../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransporter } from '../../../tests/transport/SubjectOutboundTransport'
import { Agent } from '../src/agent/Agent'
import { Attachment, AttachmentData } from '../src/decorators/attachment/Attachment'
import { AutoAcceptCredential, CredentialPreview, CredentialPreviewAttribute } from '../src/modules/credentials'
import {
  PredicateType,
  PresentationPreview,
  PresentationPreviewAttribute,
  PresentationPreviewPredicate,
  ProofState,
  ProofAttributeInfo,
  AttributeFilter,
  ProofPredicateInfo,
} from '../src/modules/proofs'
import { LinkedAttachment } from '../src/utils/LinkedAttachment'

import { makeConnection, issueCredential, waitForProofRecord, getBaseConfig, prepareForIssuance } from './helpers'
import testLogger from './logger'

const faberConfig = getBaseConfig('Faber Proofs', {
  endpoint: 'rxjs:faber',
  autoAcceptCredentials: AutoAcceptCredential.ContentApproved,
})
const aliceConfig = getBaseConfig('Alice Proofs', {
  endpoint: 'rxjs:alice',
  autoAcceptCredentials: AutoAcceptCredential.ContentApproved,
})

const credentialPreview = new CredentialPreview({
  attributes: [
    new CredentialPreviewAttribute({
      name: 'name',
      mimeType: 'text/plain',
      value: 'John',
    }),
    new CredentialPreviewAttribute({
      name: 'age',
      mimeType: 'text/plain',
      value: '99',
    }),
  ],
})

describe('Present Proof', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let credDefId: CredDefId
  let faberConnection: ConnectionRecord
  let aliceConnection: ConnectionRecord
  let presentationPreview: PresentationPreview

  beforeAll(async () => {
    const faberMessages = new Subject<SubjectMessage>()
    const aliceMessages = new Subject<SubjectMessage>()

    const subjectMap = {
      'rxjs:faber': faberMessages,
      'rxjs:alice': aliceMessages,
    }
    faberAgent = new Agent(faberConfig.config, faberConfig.agentDependencies)
    faberAgent.setInboundTransporter(new SubjectInboundTransporter(faberMessages))
    faberAgent.setOutboundTransporter(new SubjectOutboundTransporter(aliceMessages, subjectMap))
    await faberAgent.initialize()

    aliceAgent = new Agent(aliceConfig.config, aliceConfig.agentDependencies)
    aliceAgent.setInboundTransporter(new SubjectInboundTransporter(aliceMessages))
    aliceAgent.setOutboundTransporter(new SubjectOutboundTransporter(faberMessages, subjectMap))
    await aliceAgent.initialize()

    const { definition } = await prepareForIssuance(faberAgent, ['name', 'age', 'image_0', 'image_1'])
    credDefId = definition.id

    const [agentAConnection, agentBConnection] = await makeConnection(faberAgent, aliceAgent)
    expect(agentAConnection.isReady).toBe(true)
    expect(agentBConnection.isReady).toBe(true)

    faberConnection = agentAConnection
    aliceConnection = agentBConnection

    presentationPreview = new PresentationPreview({
      attributes: [
        new PresentationPreviewAttribute({
          name: 'name',
          credentialDefinitionId: credDefId,
          referent: '0',
          value: 'John',
        }),
        new PresentationPreviewAttribute({
          name: 'image_0',
          credentialDefinitionId: credDefId,
        }),
      ],
      predicates: [
        new PresentationPreviewPredicate({
          name: 'age',
          credentialDefinitionId: credDefId,
          predicate: PredicateType.GreaterThanOrEqualTo,
          threshold: 50,
        }),
      ],
    })

    await issueCredential({
      issuerAgent: faberAgent,
      issuerConnectionId: faberConnection.id,
      holderAgent: aliceAgent,
      credentialTemplate: {
        credentialDefinitionId: credDefId,
        comment: 'some comment about credential',
        preview: credentialPreview,
        linkedAttachments: [
          new LinkedAttachment({
            name: 'image_0',
            attachment: new Attachment({
              filename: 'picture-of-a-cat.png',
              data: new AttachmentData({ base64: 'cGljdHVyZSBvZiBhIGNhdA==' }),
            }),
          }),
          new LinkedAttachment({
            name: 'image_1',
            attachment: new Attachment({
              filename: 'picture-of-a-dog.png',
              data: new AttachmentData({ base64: 'UGljdHVyZSBvZiBhIGRvZw==' }),
            }),
          }),
        ],
      },
    })
  })

  afterAll(async () => {
    await aliceAgent.shutdown({
      deleteWallet: true,
    })
    await faberAgent.shutdown({
      deleteWallet: true,
    })
  })

  test('Alice starts with proof proposal to Faber', async () => {
    testLogger.test('Alice sends presentation proposal to Faber')
    let aliceProofRecord = await aliceAgent.proofs.proposeProof(aliceConnection.id, presentationPreview)

    testLogger.test('Faber waits for presentation proposal from Alice')
    let faberProofRecord = await waitForProofRecord(faberAgent, {
      threadId: aliceProofRecord.threadId,
      state: ProofState.ProposalReceived,
    })

    testLogger.test('Faber accepts presentation proposal from Alice')
    faberProofRecord = await faberAgent.proofs.acceptProposal(faberProofRecord.id)

    testLogger.test('Alice waits for presentation request from Faber')
    aliceProofRecord = await waitForProofRecord(aliceAgent, {
      threadId: aliceProofRecord.threadId,
      state: ProofState.RequestReceived,
    })

    testLogger.test('Alice accepts presentation request from Faber')
    const indyProofRequest = aliceProofRecord.requestMessage?.indyProofRequest
    const retrievedCredentials = await aliceAgent.proofs.getRequestedCredentialsForProofRequest(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      indyProofRequest!,
      presentationPreview
    )
    const requestedCredentials = aliceAgent.proofs.autoSelectCredentialsForProofRequest(retrievedCredentials)
    await aliceAgent.proofs.acceptRequest(aliceProofRecord.id, requestedCredentials)

    testLogger.test('Faber waits for presentation from Alice')
    faberProofRecord = await waitForProofRecord(faberAgent, {
      threadId: aliceProofRecord.threadId,
      state: ProofState.PresentationReceived,
    })

    // assert presentation is valid
    expect(faberProofRecord.isVerified).toBe(true)

    // Faber accepts presentation
    await faberAgent.proofs.acceptPresentation(faberProofRecord.id)

    // Alice waits till it receives presentation ack
    aliceProofRecord = await waitForProofRecord(aliceAgent, {
      threadId: aliceProofRecord.threadId,
      state: ProofState.Done,
    })
  })

  test('Faber starts with proof requests to Alice', async () => {
    testLogger.test('Faber sends presentation request to Alice')

    const attributes = {
      name: new ProofAttributeInfo({
        name: 'name',
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: credDefId,
          }),
        ],
      }),
      image_0: new ProofAttributeInfo({
        name: 'image_0',
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: credDefId,
          }),
        ],
      }),
      image_1: new ProofAttributeInfo({
        name: 'image_1',
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: credDefId,
          }),
        ],
      }),
    }

    const predicates = {
      age: new ProofPredicateInfo({
        name: 'age',
        predicateType: PredicateType.GreaterThanOrEqualTo,
        predicateValue: 50,
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: credDefId,
          }),
        ],
      }),
    }

    let faberProofRecord = await faberAgent.proofs.requestProof(faberConnection.id, {
      name: 'test-proof-request',
      requestedAttributes: attributes,
      requestedPredicates: predicates,
    })

    testLogger.test('Alice waits for presentation request from Faber')
    let aliceProofRecord = await waitForProofRecord(aliceAgent, {
      threadId: faberProofRecord.threadId,
      state: ProofState.RequestReceived,
    })

    testLogger.test('Alice accepts presentation request from Faber')
    const indyProofRequest = aliceProofRecord.requestMessage?.indyProofRequest
    const retrievedCredentials = await aliceAgent.proofs.getRequestedCredentialsForProofRequest(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      indyProofRequest!,
      presentationPreview
    )
    const requestedCredentials = aliceAgent.proofs.autoSelectCredentialsForProofRequest(retrievedCredentials)
    await aliceAgent.proofs.acceptRequest(aliceProofRecord.id, requestedCredentials)

    testLogger.test('Faber waits for presentation from Alice')
    faberProofRecord = await waitForProofRecord(faberAgent, {
      threadId: aliceProofRecord.threadId,
      state: ProofState.PresentationReceived,
    })

    // assert presentation is valid
    expect(faberProofRecord.isVerified).toBe(true)

    // Faber accepts presentation
    await faberAgent.proofs.acceptPresentation(faberProofRecord.id)

    // Alice waits till it receives presentation ack
    aliceProofRecord = await waitForProofRecord(aliceAgent, {
      threadId: aliceProofRecord.threadId,
      state: ProofState.Done,
    })
  })
})
