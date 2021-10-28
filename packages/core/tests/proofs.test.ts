import type { Agent, ConnectionRecord, PresentationPreview, ProofRequest } from '../src'
import type { CredDefId } from 'indy-sdk'

import {
  AttributeFilter,
  JsonTransformer,
  PredicateType,
  PresentationMessage,
  ProofAttributeInfo,
  ProofPredicateInfo,
  ProofRecord,
  ProofState,
  ProposePresentationMessage,
  RequestPresentationMessage,
} from '../src'

import { setupProofsTest, waitForProofRecord } from './helpers'
import testLogger from './logger'

describe('Present Proof', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let credDefId: CredDefId
  let faberConnection: ConnectionRecord
  let aliceConnection: ConnectionRecord
  let presentationPreview: PresentationPreview

  beforeAll(async () => {
    testLogger.test('Initializing the agents')
    ;({ faberAgent, aliceAgent, credDefId, faberConnection, aliceConnection, presentationPreview } =
      await setupProofsTest('Faber agent', 'Alice agent'))
  })

  afterAll(async () => {
    testLogger.test('Shutting down both agents')
    await aliceAgent.shutdown({
      deleteWallet: true,
    })
    await faberAgent.shutdown({
      deleteWallet: true,
    })
  })

  test('Alice starts with proof proposal to Faber', async () => {
    // Alice sends a presentation proposal to Faber
    testLogger.test('Alice sends a presentation proposal to Faber')
    let aliceProofRecord = await aliceAgent.proofs.proposeProof(aliceConnection.id, presentationPreview)

    // Faber waits for a presentation proposal from Alice
    testLogger.test('Faber waits for a presentation proposal from Alice')
    let faberProofRecord = await waitForProofRecord(faberAgent, {
      threadId: aliceProofRecord.threadId,
      state: ProofState.ProposalReceived,
    })

    expect(JsonTransformer.toJSON(aliceProofRecord)).toMatchObject({
      createdAt: expect.any(Date),
      id: expect.any(String),
      proposalMessage: {
        '@type': 'https://didcomm.org/present-proof/1.0/propose-presentation',
        '@id': expect.any(String),
        presentation_proposal: {
          '@type': 'https://didcomm.org/present-proof/1.0/presentation-preview',
          attributes: [
            {
              name: 'name',
              value: 'John',
            },
            {
              name: 'image_0',
              value: undefined,
            },
          ],
          predicates: [
            {
              name: 'age',
              predicate: '>=',
              threshold: 50,
            },
          ],
        },
      },
    })

    // Faber accepts the presentation proposal from Alice
    testLogger.test('Faber accepts the presentation proposal from Alice')
    faberProofRecord = await faberAgent.proofs.acceptProposal(faberProofRecord.id)

    // Alice waits for presentation request from Faber
    testLogger.test('Alice waits for presentation request from Faber')
    aliceProofRecord = await waitForProofRecord(aliceAgent, {
      threadId: aliceProofRecord.threadId,
      state: ProofState.RequestReceived,
    })

    // Alice retrieves the requested credentials and accepts the presentation request
    testLogger.test('Alice accepts presentation request from Faber')
    const indyProofRequest = aliceProofRecord.requestMessage?.indyProofRequest as ProofRequest
    const retrievedCredentials = await aliceAgent.proofs.getRequestedCredentialsForProofRequest(
      indyProofRequest,
      presentationPreview
    )
    const requestedCredentials = aliceAgent.proofs.autoSelectCredentialsForProofRequest(retrievedCredentials)
    await aliceAgent.proofs.acceptRequest(aliceProofRecord.id, requestedCredentials)

    // Faber waits for the presentation from Alice
    testLogger.test('Faber waits for presentation from Alice')
    faberProofRecord = await waitForProofRecord(faberAgent, {
      threadId: aliceProofRecord.threadId,
      state: ProofState.PresentationReceived,
    })

    expect(JsonTransformer.toJSON(faberProofRecord)).toMatchObject({
      createdAt: expect.any(Date),
      state: ProofState.PresentationReceived,
      isVerified: true,
      presentationMessage: {
        '@id': expect.any(String),
        '@type': 'https://didcomm.org/present-proof/1.0/presentation',
        'presentations~attach': [
          {
            '@id': 'libindy-presentation-0',
            'mime-type': 'application/json',
          },
        ],
        '~attach': [
          {
            '@id': expect.any(String),
            filename: 'picture-of-a-cat.png',
          },
        ],
      },
    })

    expect(aliceProofRecord).toMatchObject({
      type: ProofRecord.name,
      id: expect.any(String),
      _tags: {
        threadId: faberProofRecord.threadId,
        connectionId: aliceProofRecord.connectionId,
        state: ProofState.ProposalSent,
      },
    })

    // Faber accepts the presentation provided by Alice
    testLogger.test('Faber accepts the presentation provided by Alice')
    await faberAgent.proofs.acceptPresentation(faberProofRecord.id)

    // Alice waits until she received a presentation acknowledgement
    testLogger.test('Alice waits until she receives a presentation acknowledgement')
    aliceProofRecord = await waitForProofRecord(aliceAgent, {
      threadId: aliceProofRecord.threadId,
      state: ProofState.Done,
    })

    expect(faberProofRecord).toMatchObject({
      type: ProofRecord.name,
      id: expect.any(String),
      createdAt: expect.any(Date),
      threadId: aliceProofRecord.threadId,
      connectionId: expect.any(String),
      isVerified: true,
      state: ProofState.PresentationReceived,
      proposalMessage: expect.any(ProposePresentationMessage),
      requestMessage: expect.any(RequestPresentationMessage),
      presentationMessage: expect.any(PresentationMessage),
    })

    expect(aliceProofRecord).toMatchObject({
      type: ProofRecord.name,
      id: expect.any(String),
      createdAt: expect.any(Date),
      threadId: faberProofRecord.threadId,
      connectionId: expect.any(String),
      state: ProofState.Done,
      proposalMessage: expect.any(ProposePresentationMessage),
      requestMessage: expect.any(RequestPresentationMessage),
      presentationMessage: expect.any(PresentationMessage),
    })
  })

  test('Faber starts with proof request to Alice', async () => {
    // Sample attributes
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

    // Faber sends a presentation request to Alice
    testLogger.test('Faber sends a presentation request to Alice')
    let faberProofRecord = await faberAgent.proofs.requestProof(faberConnection.id, {
      name: 'test-proof-request',
      requestedAttributes: attributes,
      requestedPredicates: predicates,
    })

    // Alice waits for presentation request from Faber
    testLogger.test('Alice waits for presentation request from Faber')
    let aliceProofRecord = await waitForProofRecord(aliceAgent, {
      threadId: faberProofRecord.threadId,
      state: ProofState.RequestReceived,
    })

    expect(JsonTransformer.toJSON(aliceProofRecord)).toMatchObject({
      id: expect.any(String),
      createdAt: expect.any(Date),
      requestMessage: {
        '@id': expect.any(String),
        '@type': 'https://didcomm.org/present-proof/1.0/request-presentation',
        'request_presentations~attach': [
          {
            '@id': 'libindy-request-presentation-0',
            'mime-type': 'application/json',
          },
        ],
      },
    })

    // Alice retrieves the requested credentials and accepts the presentation request
    testLogger.test('Alice accepts presentation request from Faber')
    const indyProofRequest = aliceProofRecord.requestMessage?.indyProofRequest as ProofRequest
    const retrievedCredentials = await aliceAgent.proofs.getRequestedCredentialsForProofRequest(
      indyProofRequest,
      presentationPreview
    )
    const requestedCredentials = aliceAgent.proofs.autoSelectCredentialsForProofRequest(retrievedCredentials)
    await aliceAgent.proofs.acceptRequest(aliceProofRecord.id, requestedCredentials)

    // Faber waits until it receives a presentation from Alice
    testLogger.test('Faber waits for presentation from Alice')
    faberProofRecord = await waitForProofRecord(faberAgent, {
      threadId: aliceProofRecord.threadId,
      state: ProofState.PresentationReceived,
    })

    expect(faberProofRecord).toMatchObject({
      id: expect.any(String),
      createdAt: expect.any(Date),
      state: ProofState.PresentationReceived,
      requestMessage: expect.any(RequestPresentationMessage),
      isVerified: true,
      presentationMessage: {
        type: 'https://didcomm.org/present-proof/1.0/presentation',
        id: expect.any(String),
        presentationAttachments: [
          {
            id: 'libindy-presentation-0',
            mimeType: 'application/json',
          },
        ],
        attachments: [
          {
            id: 'zQmfDXo7T3J43j3CTkEZaz7qdHuABhWktksZ7JEBueZ5zUS',
            filename: 'picture-of-a-cat.png',
            data: {
              base64: expect.any(String),
            },
          },
          {
            id: 'zQmRHBT9rDs5QhsnYuPY3mNpXxgLcnNXkhjWJvTSAPMmcVd',
            filename: 'picture-of-a-dog.png',
          },
        ],
        thread: {
          threadId: aliceProofRecord.threadId,
        },
      },
    })

    // Faber accepts the presentation
    testLogger.test('Faber accept the presentation from Alice')
    await faberAgent.proofs.acceptPresentation(faberProofRecord.id)

    // Alice waits until she receives a presentation acknowledgement
    testLogger.test('Alice waits for acceptance by Faber')
    aliceProofRecord = await waitForProofRecord(aliceAgent, {
      threadId: aliceProofRecord.threadId,
      state: ProofState.Done,
    })

    expect(faberProofRecord).toMatchObject({
      type: ProofRecord.name,
      id: expect.any(String),
      createdAt: expect.any(Date),
      threadId: aliceProofRecord.threadId,
      connectionId: expect.any(String),
      isVerified: true,
      state: ProofState.PresentationReceived,
      requestMessage: expect.any(RequestPresentationMessage),
      presentationMessage: expect.any(PresentationMessage),
    })

    expect(aliceProofRecord).toMatchObject({
      type: ProofRecord.name,
      id: expect.any(String),
      createdAt: expect.any(Date),
      threadId: faberProofRecord.threadId,
      connectionId: expect.any(String),
      state: ProofState.Done,
      requestMessage: expect.any(RequestPresentationMessage),
      presentationMessage: expect.any(PresentationMessage),
    })
  })
})
