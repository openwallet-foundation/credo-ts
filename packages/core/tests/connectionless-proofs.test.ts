import {
  PredicateType,
  ProofState,
  ProofAttributeInfo,
  AttributeFilter,
  ProofPredicateInfo,
  AutoAcceptProof,
} from '../src/modules/proofs'

import { setupProofsTest, waitForProofRecordSubject } from './helpers'
import testLogger from './logger'

describe('Present Proof', () => {
  test('Faber starts with connection-less proof requests to Alice', async () => {
    const { aliceAgent, faberAgent, aliceReplay, credDefId, faberReplay } = await setupProofsTest(
      'Faber connection-less Proofs',
      'Alice connection-less Proofs',
      AutoAcceptProof.Never
    )
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

    // eslint-disable-next-line prefer-const
    let { proofRecord: faberProofRecord, requestMessage } = await faberAgent.proofs.createOutOfBandRequest({
      name: 'test-proof-request',
      requestedAttributes: attributes,
      requestedPredicates: predicates,
    })

    await aliceAgent.receiveMessage(requestMessage.toJSON())

    testLogger.test('Alice waits for presentation request from Faber')
    let aliceProofRecord = await waitForProofRecordSubject(aliceReplay, {
      threadId: faberProofRecord.threadId,
      state: ProofState.RequestReceived,
    })

    testLogger.test('Alice accepts presentation request from Faber')
    const retrievedCredentials = await aliceAgent.proofs.getRequestedCredentialsForProofRequest(aliceProofRecord.id, {
      filterByPresentationPreview: true,
    })
    const requestedCredentials = aliceAgent.proofs.autoSelectCredentialsForProofRequest(retrievedCredentials)
    await aliceAgent.proofs.acceptRequest(aliceProofRecord.id, requestedCredentials)

    testLogger.test('Faber waits for presentation from Alice')
    faberProofRecord = await waitForProofRecordSubject(faberReplay, {
      threadId: aliceProofRecord.threadId,
      state: ProofState.PresentationReceived,
    })

    // assert presentation is valid
    expect(faberProofRecord.isVerified).toBe(true)

    // Faber accepts presentation
    await faberAgent.proofs.acceptPresentation(faberProofRecord.id)

    // Alice waits till it receives presentation ack
    aliceProofRecord = await waitForProofRecordSubject(aliceReplay, {
      threadId: aliceProofRecord.threadId,
      state: ProofState.Done,
    })
  })

  test('Faber starts with connection-less proof requests to Alice with auto-accept enabled', async () => {
    testLogger.test('Faber sends presentation request to Alice')

    const { aliceAgent, faberAgent, aliceReplay, credDefId, faberReplay } = await setupProofsTest(
      'Faber connection-less Proofs - Auto Accept',
      'Alice connection-less Proofs - Auto Accept',
      AutoAcceptProof.Always
    )

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

    // eslint-disable-next-line prefer-const
    let { proofRecord: faberProofRecord, requestMessage } = await faberAgent.proofs.createOutOfBandRequest(
      {
        name: 'test-proof-request',
        requestedAttributes: attributes,
        requestedPredicates: predicates,
      },
      {
        autoAcceptProof: AutoAcceptProof.ContentApproved,
      }
    )

    await aliceAgent.receiveMessage(requestMessage.toJSON())

    await waitForProofRecordSubject(aliceReplay, {
      threadId: faberProofRecord.threadId,
      state: ProofState.Done,
    })

    await waitForProofRecordSubject(faberReplay, {
      threadId: faberProofRecord.threadId,
      state: ProofState.Done,
    })
  })
})
