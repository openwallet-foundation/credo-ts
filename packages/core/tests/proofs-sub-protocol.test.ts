import type { Agent, ConnectionRecord, ProofExchangeRecord } from '../src'
import type { V1PresentationPreview } from '../src/modules/proofs/protocol/v1/models/V1PresentationPreview'
import type { CredDefId } from 'indy-sdk'

import {
  ProofAttributeInfo,
  AttributeFilter,
  ProofPredicateInfo,
  PredicateType,
} from '../src/modules/proofs/formats/indy/models'
import { ProofState } from '../src/modules/proofs/models/ProofState'
import { uuid } from '../src/utils/uuid'

import { setupProofsTest, waitForProofExchangeRecord } from './helpers'
import testLogger from './logger'

describe('Present Proof Subprotocol', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let credDefId: CredDefId
  let faberConnection: ConnectionRecord
  let aliceConnection: ConnectionRecord
  let aliceProofExchangeRecord: ProofExchangeRecord
  let presentationPreview: V1PresentationPreview

  beforeAll(async () => {
    testLogger.test('Initializing the agents')
    ;({ faberAgent, aliceAgent, credDefId, faberConnection, aliceConnection, presentationPreview } =
      await setupProofsTest('Faber agent', 'Alice agent'))
    testLogger.test('Issuing second credential')
  })

  afterAll(async () => {
    testLogger.test('Shutting down both agents')
    await faberAgent.shutdown()
    await faberAgent.wallet.delete()
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
  })

  test('Alice starts with v1 proof proposal to Faber with parentThreadId', async () => {
    const parentThreadId = uuid()

    // Alice sends a presentation proposal to Faber
    testLogger.test('Alice sends a presentation proposal to Faber')

    const faberProofExchangeRecordPromise = waitForProofExchangeRecord(faberAgent, {
      parentThreadId,
      state: ProofState.ProposalReceived,
    })

    aliceProofExchangeRecord = await aliceAgent.proofs.proposeProof({
      connectionId: aliceConnection.id,
      protocolVersion: 'v1',
      parentThreadId,
      proofFormats: {
        indy: {
          name: 'abc',
          version: '1.0',
          attributes: presentationPreview.attributes,
          predicates: presentationPreview.predicates,
        },
      },
    })

    expect(aliceProofExchangeRecord.parentThreadId).toBe(parentThreadId)
    const proofsByParentThread = await aliceAgent.proofs.getByParentThreadAndConnectionId(parentThreadId)
    expect(proofsByParentThread.length).toEqual(1)
    expect(proofsByParentThread[0].parentThreadId).toBe(parentThreadId)

    const threadId = aliceProofExchangeRecord.threadId

    testLogger.test('Faber waits for a presentation proposal from Alice')
    let faberProofExchangeRecord = await faberProofExchangeRecordPromise

    // Faber accepts the presentation proposal from Alice
    testLogger.test('Faber accepts the presentation proposal from Alice')
    await faberAgent.proofs.acceptProposal({ proofRecordId: faberProofExchangeRecord.id })

    testLogger.test('Alice waits till it receives presentation ack')
    await waitForProofExchangeRecord(aliceAgent, {
      threadId,
      parentThreadId,
      state: ProofState.RequestReceived,
    })

    // Alice retrieves the requested credentials and accepts the presentation request
    testLogger.test('Alice accepts presentation request from Faber')
    const requestedCredentials = await aliceAgent.proofs.selectCredentialsForRequest({
      proofRecordId: aliceProofExchangeRecord.id,
    })
    await aliceAgent.proofs.acceptRequest({
      proofRecordId: aliceProofExchangeRecord.id,
      proofFormats: requestedCredentials.proofFormats,
    })

    testLogger.test('Faber waits for presentation from Alice')
    faberProofExchangeRecord = await waitForProofExchangeRecord(faberAgent, {
      threadId,
      parentThreadId,
      state: ProofState.PresentationReceived,
    })

    // Faber accepts the presentation provided by Alice
    testLogger.test('Faber accepts the presentation provided by Alice')
    await faberAgent.proofs.acceptPresentation({ proofRecordId: faberProofExchangeRecord.id })

    // Alice waits until she received a presentation acknowledgement
    testLogger.test('Alice waits until she receives a presentation acknowledgement')
    await waitForProofExchangeRecord(aliceAgent, {
      threadId,
      parentThreadId,
      state: ProofState.Done,
    })
  })

  test('Faber starts with v1 proof requests to Alice with parentThreadId', async () => {
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

    const aliceProofExchangeRecordPromise = waitForProofExchangeRecord(aliceAgent, {
      parentThreadId,
      state: ProofState.RequestReceived,
    })

    // Faber sends a presentation request to Alice
    testLogger.test('Faber sends a presentation request to Alice')
    const faberProofExchangeRecord = await faberAgent.proofs.requestProof({
      connectionId: faberConnection.id,
      parentThreadId,
      protocolVersion: 'v1',
      proofFormats: {
        indy: {
          name: 'proof-request',
          version: '1.0',
          requestedAttributes: attributes,
          requestedPredicates: predicates,
        },
      },
    })

    expect(faberProofExchangeRecord.parentThreadId).toBe(parentThreadId)
    const proofsByParentThread = await faberAgent.proofs.getByParentThreadAndConnectionId(parentThreadId)
    expect(proofsByParentThread.length).toEqual(1)
    expect(proofsByParentThread[0].parentThreadId).toBe(parentThreadId)

    const threadId = faberProofExchangeRecord.threadId

    // Alice waits for presentation request from Faber
    testLogger.test('Alice waits for presentation request from Faber')
    const aliceProofExchangeRecord = await aliceProofExchangeRecordPromise

    // Alice retrieves the requested credentials and accepts the presentation request
    testLogger.test('Alice accepts presentation request from Faber')
    const requestedCredentials = await aliceAgent.proofs.selectCredentialsForRequest({
      proofRecordId: aliceProofExchangeRecord.id,
    })
    await aliceAgent.proofs.acceptRequest({
      proofRecordId: aliceProofExchangeRecord.id,
      proofFormats: requestedCredentials.proofFormats,
    })

    // Faber waits until it receives a presentation from Alice
    testLogger.test('Faber waits for presentation from Alice')
    await waitForProofExchangeRecord(faberAgent, {
      threadId,
      parentThreadId,
      state: ProofState.PresentationReceived,
    })

    // Faber accepts the presentation
    testLogger.test('Faber accept the presentation from Alice')
    await faberAgent.proofs.acceptPresentation({ proofRecordId: faberProofExchangeRecord.id })

    // Alice waits until she receives a presentation acknowledgement
    testLogger.test('Alice waits for acceptance by Faber')
    await waitForProofExchangeRecord(aliceAgent, {
      threadId,
      parentThreadId,
      state: ProofState.Done,
    })
  })

  test('Alice starts with v2 proof proposal to Faber with parentThreadId', async () => {
    const parentThreadId = uuid()

    // Alice sends a presentation proposal to Faber
    testLogger.test('Alice sends a presentation proposal to Faber')

    const faberProofExchangeRecordPromise = waitForProofExchangeRecord(faberAgent, {
      parentThreadId,
      state: ProofState.ProposalReceived,
    })

    aliceProofExchangeRecord = await aliceAgent.proofs.proposeProof({
      connectionId: aliceConnection.id,
      protocolVersion: 'v2',
      parentThreadId,
      proofFormats: {
        indy: {
          name: 'abc',
          version: '1.0',
          attributes: presentationPreview.attributes,
          predicates: presentationPreview.predicates,
        },
      },
    })

    expect(aliceProofExchangeRecord.parentThreadId).toBe(parentThreadId)
    const proofsByParentThread = await aliceAgent.proofs.getByParentThreadAndConnectionId(parentThreadId)
    expect(proofsByParentThread.length).toEqual(1)
    expect(proofsByParentThread[0].parentThreadId).toBe(parentThreadId)

    const threadId = aliceProofExchangeRecord.threadId

    testLogger.test('Faber waits for a presentation proposal from Alice')
    let faberProofExchangeRecord = await faberProofExchangeRecordPromise

    // Faber accepts the presentation proposal from Alice
    testLogger.test('Faber accepts the presentation proposal from Alice')
    await faberAgent.proofs.acceptProposal({ proofRecordId: faberProofExchangeRecord.id })

    testLogger.test('Alice waits till it receives presentation ack')
    await waitForProofExchangeRecord(aliceAgent, {
      threadId,
      parentThreadId,
      state: ProofState.RequestReceived,
    })

    // Alice retrieves the requested credentials and accepts the presentation request
    testLogger.test('Alice accepts presentation request from Faber')
    const requestedCredentials = await aliceAgent.proofs.selectCredentialsForRequest({
      proofRecordId: aliceProofExchangeRecord.id,
    })
    await aliceAgent.proofs.acceptRequest({
      proofRecordId: aliceProofExchangeRecord.id,
      proofFormats: requestedCredentials.proofFormats,
    })

    testLogger.test('Faber waits for presentation from Alice')
    faberProofExchangeRecord = await waitForProofExchangeRecord(faberAgent, {
      threadId,
      parentThreadId,
      state: ProofState.PresentationReceived,
    })

    // Faber accepts the presentation provided by Alice
    testLogger.test('Faber accepts the presentation provided by Alice')
    await faberAgent.proofs.acceptPresentation({ proofRecordId: faberProofExchangeRecord.id })

    // Alice waits until she received a presentation acknowledgement
    testLogger.test('Alice waits until she receives a presentation acknowledgement')
    await waitForProofExchangeRecord(aliceAgent, {
      threadId,
      parentThreadId,
      state: ProofState.Done,
    })
  })

  test('Faber starts with v2 proof requests to Alice with parentThreadId', async () => {
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

    const aliceProofExchangeRecordPromise = waitForProofExchangeRecord(aliceAgent, {
      parentThreadId,
      state: ProofState.RequestReceived,
    })

    // Faber sends a presentation request to Alice
    testLogger.test('Faber sends a presentation request to Alice')
    const faberProofExchangeRecord = await faberAgent.proofs.requestProof({
      connectionId: faberConnection.id,
      parentThreadId,
      protocolVersion: 'v2',
      proofFormats: {
        indy: {
          name: 'proof-request',
          version: '1.0',
          requestedAttributes: attributes,
          requestedPredicates: predicates,
        },
      },
    })

    expect(faberProofExchangeRecord.parentThreadId).toBe(parentThreadId)
    const proofsByParentThread = await faberAgent.proofs.getByParentThreadAndConnectionId(parentThreadId)
    expect(proofsByParentThread.length).toEqual(1)
    expect(proofsByParentThread[0].parentThreadId).toBe(parentThreadId)

    const threadId = faberProofExchangeRecord.threadId

    // Alice waits for presentation request from Faber
    testLogger.test('Alice waits for presentation request from Faber')
    const aliceProofExchangeRecord = await aliceProofExchangeRecordPromise

    // Alice retrieves the requested credentials and accepts the presentation request
    testLogger.test('Alice accepts presentation request from Faber')
    const requestedCredentials = await aliceAgent.proofs.selectCredentialsForRequest({
      proofRecordId: aliceProofExchangeRecord.id,
    })
    await aliceAgent.proofs.acceptRequest({
      proofRecordId: aliceProofExchangeRecord.id,
      proofFormats: requestedCredentials.proofFormats,
    })

    // Faber waits until it receives a presentation from Alice
    testLogger.test('Faber waits for presentation from Alice')
    await waitForProofExchangeRecord(faberAgent, {
      threadId,
      parentThreadId,
      state: ProofState.PresentationReceived,
    })

    // Faber accepts the presentation
    testLogger.test('Faber accept the presentation from Alice')
    await faberAgent.proofs.acceptPresentation({ proofRecordId: faberProofExchangeRecord.id })

    // Alice waits until she receives a presentation acknowledgement
    testLogger.test('Alice waits for acceptance by Faber')
    await waitForProofExchangeRecord(aliceAgent, {
      threadId,
      parentThreadId,
      state: ProofState.Done,
    })
  })
})
