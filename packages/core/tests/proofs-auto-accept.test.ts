import type { Agent, ConnectionRecord, PresentationPreview } from '../src'
import type { CredDefId } from 'indy-sdk'

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
  let credDefId: CredDefId
  let faberConnection: ConnectionRecord
  let aliceConnection: ConnectionRecord
  let presentationPreview: PresentationPreview

  describe('Auto accept on `always`', () => {
    beforeAll(async () => {
      ;({ faberAgent, aliceAgent, credDefId, faberConnection, aliceConnection, presentationPreview } =
        await setupProofsTest('faber agent always', 'alice agent always', AutoAcceptProof.Always))
    })

    afterAll(async () => {
      await aliceAgent.shutdown({
        deleteWallet: true,
      })
      await faberAgent.shutdown({
        deleteWallet: true,
      })
    })

    test('Alice starts with proof proposal to Faber, both with autoAcceptProof on `always`', async () => {
      testLogger.test('Alice sends presentation proposal to Faber')
      const aliceProofRecord = await aliceAgent.proofs.proposeProof(aliceConnection.id, presentationPreview)

      testLogger.test('Faber waits for presentation from Alice')
      await waitForProofRecord(faberAgent, {
        threadId: aliceProofRecord.threadId,
        state: ProofState.Done,
      })

      testLogger.test('Alice waits till it receives presentation ack')
      await waitForProofRecord(aliceAgent, {
        threadId: aliceProofRecord.threadId,
        state: ProofState.Done,
      })
    })

    test('Faber starts with proof requests to Alice, both with autoAcceptProof on `always`', async () => {
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

      const faberProofRecord = await faberAgent.proofs.requestProof(faberConnection.id, {
        name: 'test-proof-request',
        requestedAttributes: attributes,
        requestedPredicates: predicates,
      })

      testLogger.test('Faber waits for presentation from Alice')
      await waitForProofRecord(faberAgent, {
        threadId: faberProofRecord.threadId,
        state: ProofState.Done,
      })

      // Alice waits till it receives presentation ack
      await waitForProofRecord(aliceAgent, {
        threadId: faberProofRecord.threadId,
        state: ProofState.Done,
      })
    })
  })

  describe('Auto accept on `contentApproved`', () => {
    beforeAll(async () => {
      ;({ faberAgent, aliceAgent, credDefId, faberConnection, aliceConnection, presentationPreview } =
        await setupProofsTest('faber agent', 'alice agent', AutoAcceptProof.ContentApproved))
    })

    afterAll(async () => {
      await aliceAgent.shutdown({
        deleteWallet: true,
      })
      await faberAgent.shutdown({
        deleteWallet: true,
      })
    })

    test('Alice starts with proof proposal to Faber, both with autoacceptproof on `contentApproved`', async () => {
      testLogger.test('Alice sends presentation proposal to Faber')
      const aliceProofRecord = await aliceAgent.proofs.proposeProof(aliceConnection.id, presentationPreview)

      testLogger.test('Faber waits for presentation proposal from Alice')
      const faberProofRecord = await waitForProofRecord(faberAgent, {
        threadId: aliceProofRecord.threadId,
        state: ProofState.ProposalReceived,
      })

      testLogger.test('Faber accepts presentation proposal from Alice')
      await faberAgent.proofs.acceptProposal(faberProofRecord.id)

      testLogger.test('Faber waits for presentation from Alice')
      await waitForProofRecord(faberAgent, {
        threadId: aliceProofRecord.threadId,
        state: ProofState.Done,
      })

      // Alice waits till it receives presentation ack
      await waitForProofRecord(aliceAgent, {
        threadId: aliceProofRecord.threadId,
        state: ProofState.Done,
      })
    })

    test('Faber starts with proof requests to Alice, both with autoacceptproof on `contentApproved`', async () => {
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

      const faberProofRecord = await faberAgent.proofs.requestProof(faberConnection.id, {
        name: 'test-proof-request',
        requestedAttributes: attributes,
        requestedPredicates: predicates,
      })

      testLogger.test('Alice waits for presentation request from Faber')
      const aliceProofRecord = await waitForProofRecord(aliceAgent, {
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
      await waitForProofRecord(faberAgent, {
        threadId: aliceProofRecord.threadId,
        state: ProofState.Done,
      })

      // Alice waits till it receives presentation ack
      await waitForProofRecord(aliceAgent, {
        threadId: aliceProofRecord.threadId,
        state: ProofState.Done,
      })
    })
  })
})
