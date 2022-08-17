import type { Agent, ConnectionRecord, ProofRecord } from '../src'
import type { PresentationPreview } from '../src/modules/proofs/protocol/v1/models/V1PresentationPreview'
import type { CredDefId } from 'indy-sdk'

import {
  ProofAttributeInfo,
  AttributeFilter,
  ProofPredicateInfo,
  PredicateType,
} from '../src/modules/proofs/formats/indy/models'
import { ProofProtocolVersion } from '../src/modules/proofs/models/ProofProtocolVersion'
import { ProofState } from '../src/modules/proofs/models/ProofState'
import { uuid } from '../src/utils/uuid'

import { setupProofsTest, waitForProofRecord } from './helpers'
import testLogger from './logger'

describe('Present Proof Subprotocol', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let credDefId: CredDefId
  let faberConnection: ConnectionRecord
  let aliceConnection: ConnectionRecord
  let aliceProofRecord: ProofRecord
  let presentationPreview: PresentationPreview

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

    const faberProofRecordPromise = waitForProofRecord(faberAgent, {
      parentThreadId,
      state: ProofState.ProposalReceived,
    })

    aliceProofRecord = await aliceAgent.proofs.proposeProof({
      connectionId: aliceConnection.id,
      protocolVersion: ProofProtocolVersion.V1,
      parentThreadId,
      proofFormats: {
        indy: {
          name: 'abc',
          version: '1.0',
          nonce: '947121108704767252195126',
          attributes: presentationPreview.attributes,
          predicates: presentationPreview.predicates,
        },
      },
    })

    expect(aliceProofRecord.parentThreadId).toBe(parentThreadId)
    const proofsByParentThread = await aliceAgent.proofs.getByParentThreadAndConnectionId(parentThreadId)
    expect(proofsByParentThread.length).toEqual(1)
    expect(proofsByParentThread[0].parentThreadId).toBe(parentThreadId)

    const threadId = aliceProofRecord.threadId

    testLogger.test('Faber waits for a presentation proposal from Alice')
    let faberProofRecord = await faberProofRecordPromise

    // Faber accepts the presentation proposal from Alice
    testLogger.test('Faber accepts the presentation proposal from Alice')
    await faberAgent.proofs.acceptProposal({ proofRecordId: faberProofRecord.id })

    testLogger.test('Alice waits till it receives presentation ack')
    await waitForProofRecord(aliceAgent, {
      threadId,
      parentThreadId,
      state: ProofState.RequestReceived,
    })

    // Alice retrieves the requested credentials and accepts the presentation request
    testLogger.test('Alice accepts presentation request from Faber')
    const requestedCredentials = await aliceAgent.proofs.autoSelectCredentialsForProofRequest({
      proofRecordId: aliceProofRecord.id,
      config: {
        filterByPresentationPreview: true,
      },
    })
    await aliceAgent.proofs.acceptRequest({
      proofRecordId: aliceProofRecord.id,
      proofFormats: requestedCredentials.proofFormats,
    })

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

    const aliceProofRecordPromise = waitForProofRecord(aliceAgent, {
      parentThreadId,
      state: ProofState.RequestReceived,
    })

    // Faber sends a presentation request to Alice
    testLogger.test('Faber sends a presentation request to Alice')
    const faberProofRecord = await faberAgent.proofs.requestProof({
      connectionId: faberConnection.id,
      parentThreadId,
      protocolVersion: ProofProtocolVersion.V1,
      proofFormats: {
        indy: {
          name: 'proof-request',
          version: '1.0',
          nonce: '1298236324864',
          requestedAttributes: attributes,
          requestedPredicates: predicates,
        },
      },
    })

    expect(faberProofRecord.parentThreadId).toBe(parentThreadId)
    const proofsByParentThread = await faberAgent.proofs.getByParentThreadAndConnectionId(parentThreadId)
    expect(proofsByParentThread.length).toEqual(1)
    expect(proofsByParentThread[0].parentThreadId).toBe(parentThreadId)

    const threadId = faberProofRecord.threadId

    // Alice waits for presentation request from Faber
    testLogger.test('Alice waits for presentation request from Faber')
    const aliceProofRecord = await aliceProofRecordPromise

    // Alice retrieves the requested credentials and accepts the presentation request
    testLogger.test('Alice accepts presentation request from Faber')
    const requestedCredentials = await aliceAgent.proofs.autoSelectCredentialsForProofRequest({
      proofRecordId: aliceProofRecord.id,
      config: {
        filterByPresentationPreview: true,
      },
    })
    await aliceAgent.proofs.acceptRequest({
      proofRecordId: aliceProofRecord.id,
      proofFormats: requestedCredentials.proofFormats,
    })

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

  test('Alice starts with v2 proof proposal to Faber with parentThreadId', async () => {
    const parentThreadId = uuid()

    // Alice sends a presentation proposal to Faber
    testLogger.test('Alice sends a presentation proposal to Faber')

    const faberProofRecordPromise = waitForProofRecord(faberAgent, {
      parentThreadId,
      state: ProofState.ProposalReceived,
    })

    aliceProofRecord = await aliceAgent.proofs.proposeProof({
      connectionId: aliceConnection.id,
      protocolVersion: ProofProtocolVersion.V2,
      parentThreadId,
      proofFormats: {
        indy: {
          name: 'abc',
          version: '1.0',
          nonce: '947121108704767252195126',
          attributes: presentationPreview.attributes,
          predicates: presentationPreview.predicates,
        },
      },
    })

    expect(aliceProofRecord.parentThreadId).toBe(parentThreadId)
    const proofsByParentThread = await aliceAgent.proofs.getByParentThreadAndConnectionId(parentThreadId)
    expect(proofsByParentThread.length).toEqual(1)
    expect(proofsByParentThread[0].parentThreadId).toBe(parentThreadId)

    const threadId = aliceProofRecord.threadId

    testLogger.test('Faber waits for a presentation proposal from Alice')
    let faberProofRecord = await faberProofRecordPromise

    // Faber accepts the presentation proposal from Alice
    testLogger.test('Faber accepts the presentation proposal from Alice')
    await faberAgent.proofs.acceptProposal({ proofRecordId: faberProofRecord.id })

    testLogger.test('Alice waits till it receives presentation ack')
    await waitForProofRecord(aliceAgent, {
      threadId,
      parentThreadId,
      state: ProofState.RequestReceived,
    })

    // Alice retrieves the requested credentials and accepts the presentation request
    testLogger.test('Alice accepts presentation request from Faber')
    const requestedCredentials = await aliceAgent.proofs.autoSelectCredentialsForProofRequest({
      proofRecordId: aliceProofRecord.id,
      config: {
        filterByPresentationPreview: true,
      },
    })
    await aliceAgent.proofs.acceptRequest({
      proofRecordId: aliceProofRecord.id,
      proofFormats: requestedCredentials.proofFormats,
    })

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

    const aliceProofRecordPromise = waitForProofRecord(aliceAgent, {
      parentThreadId,
      state: ProofState.RequestReceived,
    })

    // Faber sends a presentation request to Alice
    testLogger.test('Faber sends a presentation request to Alice')
    const faberProofRecord = await faberAgent.proofs.requestProof({
      connectionId: faberConnection.id,
      parentThreadId,
      protocolVersion: ProofProtocolVersion.V2,
      proofFormats: {
        indy: {
          name: 'proof-request',
          version: '1.0',
          nonce: '1298236324864',
          requestedAttributes: attributes,
          requestedPredicates: predicates,
        },
      },
    })

    expect(faberProofRecord.parentThreadId).toBe(parentThreadId)
    const proofsByParentThread = await faberAgent.proofs.getByParentThreadAndConnectionId(parentThreadId)
    expect(proofsByParentThread.length).toEqual(1)
    expect(proofsByParentThread[0].parentThreadId).toBe(parentThreadId)

    const threadId = faberProofRecord.threadId

    // Alice waits for presentation request from Faber
    testLogger.test('Alice waits for presentation request from Faber')
    const aliceProofRecord = await aliceProofRecordPromise

    // Alice retrieves the requested credentials and accepts the presentation request
    testLogger.test('Alice accepts presentation request from Faber')
    const requestedCredentials = await aliceAgent.proofs.autoSelectCredentialsForProofRequest({
      proofRecordId: aliceProofRecord.id,
      config: {
        filterByPresentationPreview: true,
      },
    })
    await aliceAgent.proofs.acceptRequest({
      proofRecordId: aliceProofRecord.id,
      proofFormats: requestedCredentials.proofFormats,
    })

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
