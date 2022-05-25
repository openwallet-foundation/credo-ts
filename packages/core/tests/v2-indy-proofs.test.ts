import type { Agent, ConnectionRecord, ProofRecord } from '../src'
import type {
  AcceptPresentationOptions,
  AcceptProposalOptions,
  ProposeProofOptions,
  RequestProofOptions,
} from '../src/modules/proofs/models/ModuleOptions'
import type { PresentationPreview } from '../src/modules/proofs/protocol/v1/models/V1PresentationPreview'
import type { CredDefId } from 'indy-sdk'

import { AttributeFilter, PredicateType, ProofAttributeInfo, ProofPredicateInfo, ProofState } from '../src'
import {
  V2_INDY_PRESENTATION,
  V2_INDY_PRESENTATION_PROPOSAL,
  V2_INDY_PRESENTATION_REQUEST,
} from '../src/modules/proofs/formats/ProofFormats'
import { ProofProtocolVersion } from '../src/modules/proofs/models/ProofProtocolVersion'
import {
  V2PresentationMessage,
  V2ProposalPresentationMessage,
  V2RequestPresentationMessage,
} from '../src/modules/proofs/protocol/v2/messages'
import { DidCommMessageRepository } from '../src/storage/didcomm'

import { setupProofsTest, waitForProofRecord } from './helpers'
import testLogger from './logger'

describe('Present Proof', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let credDefId: CredDefId
  let aliceConnection: ConnectionRecord
  let faberConnection: ConnectionRecord
  let faberProofRecord: ProofRecord
  let aliceProofRecord: ProofRecord
  let presentationPreview: PresentationPreview
  let didCommMessageRepository: DidCommMessageRepository

  beforeAll(async () => {
    testLogger.test('Initializing the agents')
    ;({ faberAgent, aliceAgent, credDefId, faberConnection, aliceConnection, presentationPreview } =
      await setupProofsTest('Faber agent', 'Alice agent'))
  })

  afterAll(async () => {
    testLogger.test('Shutting down both agents')
    await faberAgent.shutdown()
    await faberAgent.wallet.delete()
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
  })

  test('Alice starts with proof proposal to Faber', async () => {
    // Alice sends a presentation proposal to Faber
    testLogger.test('Alice sends a presentation proposal to Faber')

    const proposeProofOptions: ProposeProofOptions = {
      connectionId: aliceConnection.id,
      protocolVersion: ProofProtocolVersion.V2,
      proofFormats: {
        indy: {
          name: 'abc',
          version: '1.0',
          nonce: '947121108704767252195126',
          attributes: presentationPreview.attributes,
          predicates: presentationPreview.predicates,
        },
      },
    }

    let faberProofRecordPromise = waitForProofRecord(faberAgent, {
      state: ProofState.ProposalReceived,
    })

    aliceProofRecord = await aliceAgent.proofs.proposeProof(proposeProofOptions)

    // Faber waits for a presentation proposal from Alice
    testLogger.test('Faber waits for a presentation proposal from Alice')
    faberProofRecord = await faberProofRecordPromise

    didCommMessageRepository = faberAgent.injectionContainer.resolve<DidCommMessageRepository>(DidCommMessageRepository)

    const proposal = await didCommMessageRepository.findAgentMessage({
      associatedRecordId: faberProofRecord.id,
      messageClass: V2ProposalPresentationMessage,
    })

    expect(proposal).toMatchObject({
      type: 'https://didcomm.org/present-proof/2.0/propose-presentation',
      formats: [
        {
          attachmentId: expect.any(String),
          format: V2_INDY_PRESENTATION_PROPOSAL,
        },
      ],
      proposalsAttach: [
        {
          id: expect.any(String),
          mimeType: 'application/json',
          data: {
            base64: expect.any(String),
          },
        },
      ],
      id: expect.any(String),
    })
    expect(faberProofRecord.id).not.toBeNull()
    expect(faberProofRecord).toMatchObject({
      threadId: faberProofRecord.threadId,
      state: ProofState.ProposalReceived,
      protocolVersion: ProofProtocolVersion.V2,
    })

    const acceptProposalOptions: AcceptProposalOptions = {
      proofRecordId: faberProofRecord.id,
    }

    let aliceProofRecordPromise = waitForProofRecord(aliceAgent, {
      state: ProofState.RequestReceived,
    })

    // Faber accepts the presentation proposal from Alice
    testLogger.test('Faber accepts presentation proposal from Alice')
    faberProofRecord = await faberAgent.proofs.acceptProposal(acceptProposalOptions)

    // Alice waits for presentation request from Faber
    testLogger.test('Alice waits for presentation request from Faber')
    aliceProofRecord = await aliceProofRecordPromise

    const request = await didCommMessageRepository.findAgentMessage({
      associatedRecordId: faberProofRecord.id,
      messageClass: V2RequestPresentationMessage,
    })

    expect(request).toMatchObject({
      type: 'https://didcomm.org/present-proof/2.0/request-presentation',
      formats: [
        {
          attachmentId: expect.any(String),
          format: V2_INDY_PRESENTATION_REQUEST,
        },
      ],
      requestPresentationsAttach: [
        {
          id: expect.any(String),
          mimeType: 'application/json',
          data: {
            base64: expect.any(String),
          },
        },
      ],
      id: expect.any(String),
      thread: {
        threadId: faberProofRecord.threadId,
      },
    })

    // Alice retrieves the requested credentials and accepts the presentation request
    testLogger.test('Alice accepts presentation request from Faber')

    const requestedCredentials = await aliceAgent.proofs.autoSelectCredentialsForProofRequest({
      proofRecordId: aliceProofRecord.id,
      config: {
        filterByPresentationPreview: true,
      },
    })

    const acceptPresentationOptions: AcceptPresentationOptions = {
      proofRecordId: aliceProofRecord.id,
      proofFormats: { indy: requestedCredentials.indy },
    }

    faberProofRecordPromise = waitForProofRecord(faberAgent, {
      threadId: aliceProofRecord.threadId,
      state: ProofState.PresentationReceived,
    })

    await aliceAgent.proofs.acceptRequest(acceptPresentationOptions)

    // Faber waits for the presentation from Alice
    testLogger.test('Faber waits for presentation from Alice')
    faberProofRecord = await faberProofRecordPromise

    const presentation = await didCommMessageRepository.findAgentMessage({
      associatedRecordId: faberProofRecord.id,
      messageClass: V2PresentationMessage,
    })

    expect(presentation).toMatchObject({
      type: 'https://didcomm.org/present-proof/2.0/presentation',
      formats: [
        {
          attachmentId: expect.any(String),
          format: V2_INDY_PRESENTATION,
        },
      ],
      presentationsAttach: [
        {
          id: expect.any(String),
          mimeType: 'application/json',
          data: {
            base64: expect.any(String),
          },
        },
      ],
      id: expect.any(String),
      thread: {
        threadId: faberProofRecord.threadId,
      },
    })
    expect(faberProofRecord.id).not.toBeNull()
    expect(faberProofRecord).toMatchObject({
      threadId: faberProofRecord.threadId,
      state: ProofState.PresentationReceived,
      protocolVersion: ProofProtocolVersion.V2,
    })

    aliceProofRecordPromise = waitForProofRecord(aliceAgent, {
      threadId: aliceProofRecord.threadId,
      state: ProofState.Done,
    })

    // Faber accepts the presentation provided by Alice
    testLogger.test('Faber accepts the presentation provided by Alice')
    await faberAgent.proofs.acceptPresentation(faberProofRecord.id)

    // Alice waits until she received a presentation acknowledgement
    testLogger.test('Alice waits until she receives a presentation acknowledgement')
    aliceProofRecord = await aliceProofRecordPromise

    expect(faberProofRecord).toMatchObject({
      // type: ProofRecord.name,
      id: expect.any(String),
      createdAt: expect.any(Date),
      threadId: aliceProofRecord.threadId,
      connectionId: expect.any(String),
      isVerified: true,
      state: ProofState.PresentationReceived,
    })

    expect(aliceProofRecord).toMatchObject({
      // type: ProofRecord.name,
      id: expect.any(String),
      createdAt: expect.any(Date),
      threadId: faberProofRecord.threadId,
      connectionId: expect.any(String),
      state: ProofState.Done,
    })
  })

  test('Faber starts with proof request to Alice', async () => {
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
    }

    // Sample predicates
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

    const requestProofsOptions: RequestProofOptions = {
      protocolVersion: ProofProtocolVersion.V2,
      connectionId: faberConnection.id,
      proofFormats: {
        indy: {
          name: 'proof-request',
          version: '1.0',
          nonce: '1298236324864',
          requestedAttributes: attributes,
          requestedPredicates: predicates,
        },
      },
    }

    let aliceProofRecordPromise = waitForProofRecord(aliceAgent, {
      state: ProofState.RequestReceived,
    })

    // Faber sends a presentation request to Alice
    testLogger.test('Faber sends a presentation request to Alice')
    faberProofRecord = await faberAgent.proofs.requestProof(requestProofsOptions)

    // Alice waits for presentation request from Faber
    testLogger.test('Alice waits for presentation request from Faber')
    aliceProofRecord = await aliceProofRecordPromise

    const request = await didCommMessageRepository.findAgentMessage({
      associatedRecordId: faberProofRecord.id,
      messageClass: V2RequestPresentationMessage,
    })

    expect(request).toMatchObject({
      type: 'https://didcomm.org/present-proof/2.0/request-presentation',
      formats: [
        {
          attachmentId: expect.any(String),
          format: V2_INDY_PRESENTATION_REQUEST,
        },
      ],
      requestPresentationsAttach: [
        {
          id: expect.any(String),
          mimeType: 'application/json',
          data: {
            base64: expect.any(String),
          },
        },
      ],
      id: expect.any(String),
    })

    expect(aliceProofRecord.id).not.toBeNull()
    expect(aliceProofRecord).toMatchObject({
      threadId: aliceProofRecord.threadId,
      state: ProofState.RequestReceived,
      protocolVersion: ProofProtocolVersion.V2,
    })

    // Alice retrieves the requested credentials and accepts the presentation request
    testLogger.test('Alice accepts presentation request from Faber')

    const requestedCredentials = await aliceAgent.proofs.autoSelectCredentialsForProofRequest({
      proofRecordId: aliceProofRecord.id,
      config: {
        filterByPresentationPreview: true,
      },
    })

    const acceptPresentationOptions: AcceptPresentationOptions = {
      proofRecordId: aliceProofRecord.id,
      proofFormats: { indy: requestedCredentials.indy },
    }

    const faberProofRecordPromise = waitForProofRecord(faberAgent, {
      threadId: aliceProofRecord.threadId,
      state: ProofState.PresentationReceived,
    })

    await aliceAgent.proofs.acceptRequest(acceptPresentationOptions)

    // Faber waits until it receives a presentation from Alice
    testLogger.test('Faber waits for presentation from Alice')
    faberProofRecord = await faberProofRecordPromise

    const presentation = await didCommMessageRepository.findAgentMessage({
      associatedRecordId: faberProofRecord.id,
      messageClass: V2PresentationMessage,
    })

    expect(presentation).toMatchObject({
      type: 'https://didcomm.org/present-proof/2.0/presentation',
      formats: [
        {
          attachmentId: expect.any(String),
          format: V2_INDY_PRESENTATION,
        },
      ],
      presentationsAttach: [
        {
          id: expect.any(String),
          mimeType: 'application/json',
          data: {
            base64: expect.any(String),
          },
        },
      ],
      id: expect.any(String),
      thread: {
        threadId: faberProofRecord.threadId,
      },
    })
    expect(faberProofRecord.id).not.toBeNull()
    expect(faberProofRecord).toMatchObject({
      threadId: faberProofRecord.threadId,
      state: ProofState.PresentationReceived,
      protocolVersion: ProofProtocolVersion.V2,
    })

    aliceProofRecordPromise = waitForProofRecord(aliceAgent, {
      threadId: aliceProofRecord.threadId,
      state: ProofState.Done,
    })

    // Faber accepts the presentation
    testLogger.test('Faber accept the presentation from Alice')
    await faberAgent.proofs.acceptPresentation(faberProofRecord.id)

    // Alice waits until she receives a presentation acknowledgement
    testLogger.test('Alice waits for acceptance by Faber')
    aliceProofRecord = await aliceProofRecordPromise

    expect(faberProofRecord).toMatchObject({
      // type: ProofRecord.name,
      id: expect.any(String),
      createdAt: expect.any(Date),
      threadId: aliceProofRecord.threadId,
      connectionId: expect.any(String),
      isVerified: true,
      state: ProofState.PresentationReceived,
    })

    expect(aliceProofRecord).toMatchObject({
      // type: ProofRecord.name,
      id: expect.any(String),
      createdAt: expect.any(Date),
      threadId: faberProofRecord.threadId,
      connectionId: expect.any(String),
      state: ProofState.Done,
    })
  })

  test('Faber starts with proof request to Alice but gets Problem Reported', async () => {
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
    }

    // Sample predicates
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

    const requestProofsOptions: RequestProofOptions = {
      protocolVersion: ProofProtocolVersion.V2,
      connectionId: faberConnection.id,
      proofFormats: {
        indy: {
          name: 'proof-request',
          version: '1.0',
          nonce: '1298236324864',
          requestedAttributes: attributes,
          requestedPredicates: predicates,
        },
      },
    }

    const aliceProofRecordPromise = waitForProofRecord(aliceAgent, {
      state: ProofState.RequestReceived,
    })

    // Faber sends a presentation request to Alice
    testLogger.test('Faber sends a presentation request to Alice')
    faberProofRecord = await faberAgent.proofs.requestProof(requestProofsOptions)

    // Alice waits for presentation request from Faber
    testLogger.test('Alice waits for presentation request from Faber')
    aliceProofRecord = await aliceProofRecordPromise

    const request = await didCommMessageRepository.findAgentMessage({
      associatedRecordId: faberProofRecord.id,
      messageClass: V2RequestPresentationMessage,
    })

    expect(request).toMatchObject({
      type: 'https://didcomm.org/present-proof/2.0/request-presentation',
      formats: [
        {
          attachmentId: expect.any(String),
          format: V2_INDY_PRESENTATION_REQUEST,
        },
      ],
      requestPresentationsAttach: [
        {
          id: expect.any(String),
          mimeType: 'application/json',
          data: {
            base64: expect.any(String),
          },
        },
      ],
      id: expect.any(String),
    })

    expect(aliceProofRecord.id).not.toBeNull()
    expect(aliceProofRecord).toMatchObject({
      threadId: aliceProofRecord.threadId,
      state: ProofState.RequestReceived,
      protocolVersion: ProofProtocolVersion.V2,
    })

    const faberProofRecordPromise = waitForProofRecord(faberAgent, {
      threadId: aliceProofRecord.threadId,
      state: ProofState.Abandoned,
    })

    aliceProofRecord = await aliceAgent.proofs.sendProblemReport(aliceProofRecord.id, 'Problem inside proof request')

    faberProofRecord = await faberProofRecordPromise

    expect(faberProofRecord).toMatchObject({
      threadId: aliceProofRecord.threadId,
      state: ProofState.Abandoned,
      protocolVersion: ProofProtocolVersion.V2,
    })
  })
})
