import type { Agent } from '../agent/Agent'
import type { ConnectionRecord } from '../modules/connections'
import type { PresentationPreview } from '../modules/proofs'
import type { CredDefId } from 'indy-sdk'

import { AttributeFilter, PredicateType, ProofAttributeInfo, ProofPredicateInfo, ProofState } from '../modules/proofs'
import { AutoAcceptProof } from '../types'

import { setupProofsTest, waitForProofRecord } from './helpers'
import testLogger from './logger'

describe('Present Proof', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let credDefId: CredDefId
  let faberConnection: ConnectionRecord
  let aliceConnection: ConnectionRecord
  let presentationPreview: PresentationPreview

  describe('Auto accept on `always`', () => {
    beforeAll(async () => {
      ;({ faberAgent, aliceAgent, faberConnection, aliceConnection, presentationPreview } = await setupProofsTest(
        'faber agent always',
        'alice agent always',
        AutoAcceptProof.always
      ))
    })

    afterAll(async () => {
      await faberAgent.closeAndDeleteWallet()
      await aliceAgent.closeAndDeleteWallet()
    })

    test('Alice starts with proof proposal to Faber', async () => {
      testLogger.test('Alice sends presentation proposal to Faber')
      let aliceProofRecord = await aliceAgent.proofs.proposeProof(aliceConnection.id, presentationPreview)

      testLogger.test('Faber waits for presentation proposal from Alice')
      let faberProofRecord = await waitForProofRecord(faberAgent, {
        threadId: aliceProofRecord.threadId,
        state: ProofState.ProposalReceived,
      })

      testLogger.test('Alice waits for presentation request from Faber')
      aliceProofRecord = await waitForProofRecord(aliceAgent, {
        threadId: aliceProofRecord.threadId,
        state: ProofState.RequestReceived,
      })

      testLogger.test('Faber waits for presentation from Alice')
      faberProofRecord = await waitForProofRecord(faberAgent, {
        threadId: aliceProofRecord.threadId,
        state: ProofState.PresentationReceived,
      })

      // assert presentation is valid
      expect(faberProofRecord.isVerified).toBe(true)

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

      testLogger.test('Faber waits for presentation from Alice')
      faberProofRecord = await waitForProofRecord(faberAgent, {
        threadId: aliceProofRecord.threadId,
        state: ProofState.PresentationReceived,
      })

      // assert presentation is valid
      expect(faberProofRecord.isVerified).toBe(true)

      // Alice waits till it receives presentation ack
      aliceProofRecord = await waitForProofRecord(aliceAgent, {
        threadId: aliceProofRecord.threadId,
        state: ProofState.Done,
      })
    })
  })

  describe('Auto accept on `contentApproved`', () => {
    beforeAll(async () => {
      ;({ faberAgent, aliceAgent, faberConnection, aliceConnection, presentationPreview } = await setupProofsTest(
        'faber agent contentApproved',
        'alice agent contentApproved',
        AutoAcceptProof.contentApproved
      ))
    })

    afterAll(async () => {
      await faberAgent.closeAndDeleteWallet()
      await aliceAgent.closeAndDeleteWallet()
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

      testLogger.test('Faber waits for presentation from Alice')
      faberProofRecord = await waitForProofRecord(faberAgent, {
        threadId: aliceProofRecord.threadId,
        state: ProofState.PresentationReceived,
      })

      // assert presentation is valid
      expect(faberProofRecord.isVerified).toBe(true)

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

      // Alice waits till it receives presentation ack
      aliceProofRecord = await waitForProofRecord(aliceAgent, {
        threadId: aliceProofRecord.threadId,
        state: ProofState.Done,
      })
    })
  })
})
