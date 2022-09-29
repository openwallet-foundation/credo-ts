import type { Agent, ConnectionRecord, PresentationPreview } from '../src'

import {
  AutoAcceptProof,
  ProofState,
  ProofAttributeInfo,
  AttributeFilter,
  ProofPredicateInfo,
  PredicateType,
} from '../src'

import { setupProofsTest, waitForProofRecord } from './helpers'
import testLogger from './logger'

describe('Auto accept present proof', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let credDefId: string
  let faberConnection: ConnectionRecord
  let aliceConnection: ConnectionRecord
  let presentationPreview: PresentationPreview

  describe('Auto accept on `always`', () => {
    beforeAll(async () => {
      ;({ faberAgent, aliceAgent, credDefId, faberConnection, aliceConnection, presentationPreview } =
        await setupProofsTest(
          'Faber Auto Accept Always Proofs',
          'Getter Auto Accept Always Proofs',
          AutoAcceptProof.Always
        ))
    })

    afterAll(async () => {
      await faberAgent.shutdown()
      await faberAgent.wallet.delete()
      await aliceAgent.shutdown()
      await aliceAgent.wallet.delete()
    })

    test('Getter starts with proof proposal to Faber, both with autoAcceptProof on `always`', async () => {
      testLogger.test('Getter sends presentation proposal to Faber')
      const aliceProofRecord = await aliceAgent.proofs.proposeProof(aliceConnection.id, presentationPreview)

      testLogger.test('Faber waits for presentation from Getter')
      await waitForProofRecord(faberAgent, {
        threadId: aliceProofRecord.threadId,
        state: ProofState.Done,
      })

      testLogger.test('Getter waits till it receives presentation ack')
      await waitForProofRecord(aliceAgent, {
        threadId: aliceProofRecord.threadId,
        state: ProofState.Done,
      })
    })

    test('Faber starts with proof requests to Getter, both with autoAcceptProof on `always`', async () => {
      testLogger.test('Faber sends presentation request to Getter')

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

      const faberProofRecord = await faberAgent.proofs.requestProof(faberConnection.id, {
        name: 'test-proof-request',
        requestedAttributes: attributes,
        requestedPredicates: predicates,
      })

      testLogger.test('Faber waits for presentation from Getter')
      await waitForProofRecord(faberAgent, {
        threadId: faberProofRecord.threadId,
        state: ProofState.Done,
      })

      // Getter waits till it receives presentation ack
      await waitForProofRecord(aliceAgent, {
        threadId: faberProofRecord.threadId,
        state: ProofState.Done,
      })
    })
  })

  describe('Auto accept on `contentApproved`', () => {
    beforeAll(async () => {
      ;({ faberAgent, aliceAgent, credDefId, faberConnection, aliceConnection, presentationPreview } =
        await setupProofsTest(
          'Faber Auto Accept Content Approved Proofs',
          'Getter Auto Accept Content Approved Proofs',
          AutoAcceptProof.ContentApproved
        ))
    })

    afterAll(async () => {
      await faberAgent.shutdown()
      await faberAgent.wallet.delete()
      await aliceAgent.shutdown()
      await aliceAgent.wallet.delete()
    })

    test('Getter starts with proof proposal to Faber, both with autoacceptproof on `contentApproved`', async () => {
      testLogger.test('Getter sends presentation proposal to Faber')
      const aliceProofRecord = await aliceAgent.proofs.proposeProof(aliceConnection.id, presentationPreview)

      testLogger.test('Faber waits for presentation proposal from Getter')
      const faberProofRecord = await waitForProofRecord(faberAgent, {
        threadId: aliceProofRecord.threadId,
        state: ProofState.ProposalReceived,
      })

      testLogger.test('Faber accepts presentation proposal from Getter')
      await faberAgent.proofs.acceptProposal(faberProofRecord.id)

      testLogger.test('Faber waits for presentation from Getter')
      await waitForProofRecord(faberAgent, {
        threadId: aliceProofRecord.threadId,
        state: ProofState.Done,
      })

      // Getter waits till it receives presentation ack
      await waitForProofRecord(aliceAgent, {
        threadId: aliceProofRecord.threadId,
        state: ProofState.Done,
      })
    })

    test('Faber starts with proof requests to Getter, both with autoacceptproof on `contentApproved`', async () => {
      testLogger.test('Faber sends presentation request to Getter')

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

      const faberProofRecord = await faberAgent.proofs.requestProof(faberConnection.id, {
        name: 'test-proof-request',
        requestedAttributes: attributes,
        requestedPredicates: predicates,
      })

      testLogger.test('Getter waits for presentation request from Faber')
      const aliceProofRecord = await waitForProofRecord(aliceAgent, {
        threadId: faberProofRecord.threadId,
        state: ProofState.RequestReceived,
      })

      testLogger.test('Getter accepts presentation request from Faber')
      const retrievedCredentials = await aliceAgent.proofs.getRequestedCredentialsForProofRequest(aliceProofRecord.id, {
        filterByPresentationPreview: true,
      })
      const requestedCredentials = aliceAgent.proofs.autoSelectCredentialsForProofRequest(retrievedCredentials)
      await aliceAgent.proofs.acceptRequest(aliceProofRecord.id, requestedCredentials)

      testLogger.test('Faber waits for presentation from Getter')
      await waitForProofRecord(faberAgent, {
        threadId: aliceProofRecord.threadId,
        state: ProofState.Done,
      })

      // Getter waits till it receives presentation ack
      await waitForProofRecord(aliceAgent, {
        threadId: aliceProofRecord.threadId,
        state: ProofState.Done,
      })
    })
  })
})
