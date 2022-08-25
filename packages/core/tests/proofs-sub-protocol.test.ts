import type { Agent, ConnectionRecord, PresentationPreview } from '../src'

import { ProofState, ProofAttributeInfo, AttributeFilter, ProofPredicateInfo, PredicateType } from '../src'
import { uuid } from '../src/utils/uuid'

import { setupProofsTest, waitForProofRecord } from './helpers'
import testLogger from './logger'

describe('Present proof started as a sub-protocol', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let credDefId: string
  let faberConnection: ConnectionRecord
  let aliceConnection: ConnectionRecord
  let presentationPreview: PresentationPreview

  beforeAll(async () => {
    testLogger.test('Initializing the agents')
    ;({ faberAgent, aliceAgent, credDefId, faberConnection, aliceConnection, presentationPreview } =
      await setupProofsTest('Faber agent', 'Alice agent'))
    testLogger.test('Issuing second credential')
  })

  afterAll(async () => {
    await faberAgent.shutdown()
    await faberAgent.wallet.delete()
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
  })

  test('Alice starts with proof proposal to Faber, ', async () => {
    const parentThreadId = uuid()

    testLogger.test('Alice sends presentation proposal to Faber')
    const aliceProofRecord = await aliceAgent.proofs.proposeProof(aliceConnection.id, presentationPreview, {
      parentThreadId,
    })

    expect(aliceProofRecord.parentThreadId).toBe(parentThreadId)
    const proofsByParentThread = await aliceAgent.proofs.getByParentThreadAndConnectionId(parentThreadId)
    expect(proofsByParentThread.length).toEqual(1)
    expect(proofsByParentThread[0].parentThreadId).toBe(parentThreadId)

    const threadId = aliceProofRecord.threadId

    testLogger.test('Faber waits for a presentation proposal from Alice')
    let faberProofRecord = await waitForProofRecord(faberAgent, {
      threadId,
      parentThreadId,
      state: ProofState.ProposalReceived,
    })

    // Faber accepts the presentation proposal from Alice
    testLogger.test('Faber accepts the presentation proposal from Alice')
    await faberAgent.proofs.acceptProposal(faberProofRecord.id)

    testLogger.test('Alice waits till it receives presentation ack')
    await waitForProofRecord(aliceAgent, {
      threadId,
      parentThreadId,
      state: ProofState.RequestReceived,
    })

    // Alice retrieves the requested credentials and accepts the presentation request
    testLogger.test('Alice accepts presentation request from Faber')
    const retrievedCredentials = await aliceAgent.proofs.getRequestedCredentialsForProofRequest(aliceProofRecord.id, {
      filterByPresentationPreview: true,
    })
    const requestedCredentials = aliceAgent.proofs.autoSelectCredentialsForProofRequest(retrievedCredentials)
    await aliceAgent.proofs.acceptRequest(aliceProofRecord.id, requestedCredentials)

    testLogger.test('Faber waits for presentation from Alice')
    faberProofRecord = await waitForProofRecord(faberAgent, {
      threadId,
      parentThreadId,
      state: ProofState.PresentationReceived,
    })

    // Faber accepts the presentation provided by Alice
    testLogger.test('Faber accepts the presentation provided by Alice')
    await faberAgent.proofs.acceptPresentation(faberProofRecord.id)

    // Alice waits until she received a presentation acknowledgement
    testLogger.test('Alice waits until she receives a presentation acknowledgement')
    await waitForProofRecord(aliceAgent, {
      threadId,
      parentThreadId,
      state: ProofState.Done,
    })
  })

  test('Faber starts with proof requests to Alice', async () => {
    const parentThreadId = uuid()
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

    // Faber sends a presentation request to Alice
    testLogger.test('Faber sends a presentation request to Alice')
    const faberProofRecord = await faberAgent.proofs.requestProof(
      faberConnection.id,
      {
        name: 'test-proof-request',
        requestedAttributes: attributes,
        requestedPredicates: predicates,
      },
      { parentThreadId }
    )

    expect(faberProofRecord.parentThreadId).toBe(parentThreadId)
    const proofsByParentThread = await faberAgent.proofs.getByParentThreadAndConnectionId(parentThreadId)
    expect(proofsByParentThread.length).toEqual(1)
    expect(proofsByParentThread[0].parentThreadId).toBe(parentThreadId)

    const threadId = faberProofRecord.threadId

    // Alice waits for presentation request from Faber
    testLogger.test('Alice waits for presentation request from Faber')
    const aliceProofRecord = await waitForProofRecord(aliceAgent, {
      threadId,
      parentThreadId,
      state: ProofState.RequestReceived,
    })

    // Alice retrieves the requested credentials and accepts the presentation request
    testLogger.test('Alice accepts presentation request from Faber')
    const retrievedCredentials = await aliceAgent.proofs.getRequestedCredentialsForProofRequest(aliceProofRecord.id, {
      filterByPresentationPreview: true,
    })
    const requestedCredentials = aliceAgent.proofs.autoSelectCredentialsForProofRequest(retrievedCredentials)
    await aliceAgent.proofs.acceptRequest(aliceProofRecord.id, requestedCredentials)

    // Faber waits until it receives a presentation from Alice
    testLogger.test('Faber waits for presentation from Alice')
    await waitForProofRecord(faberAgent, {
      threadId,
      parentThreadId,
      state: ProofState.PresentationReceived,
    })

    // Faber accepts the presentation
    testLogger.test('Faber accept the presentation from Alice')
    await faberAgent.proofs.acceptPresentation(faberProofRecord.id)

    // Alice waits until she receives a presentation acknowledgement
    testLogger.test('Alice waits for acceptance by Faber')
    await waitForProofRecord(aliceAgent, {
      threadId,
      parentThreadId,
      state: ProofState.Done,
    })
  })
})
