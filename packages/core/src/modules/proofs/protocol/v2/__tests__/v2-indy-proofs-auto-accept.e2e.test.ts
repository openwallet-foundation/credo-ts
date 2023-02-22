import type { Agent } from '../../../../../agent/Agent'
import type { ConnectionRecord } from '../../../../connections'
import type { V1PresentationPreview } from '../../v1'

import { setupProofsTest, waitForProofExchangeRecord } from '../../../../../../tests/helpers'
import testLogger from '../../../../../../tests/logger'
import { ProofAttributeInfo, AttributeFilter, ProofPredicateInfo, PredicateType } from '../../../formats/indy/models'
import { AutoAcceptProof, ProofState } from '../../../models'

describe('Auto accept present proof', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let credDefId: string
  let faberConnection: ConnectionRecord
  let aliceConnection: ConnectionRecord
  let presentationPreview: V1PresentationPreview

  describe('Auto accept on `always`', () => {
    beforeAll(async () => {
      ;({ faberAgent, aliceAgent, credDefId, faberConnection, aliceConnection, presentationPreview } =
        await setupProofsTest(
          'Faber Auto Accept Always Proofs',
          'Alice Auto Accept Always Proofs',
          AutoAcceptProof.Always
        ))
    })
    afterAll(async () => {
      await faberAgent.shutdown()
      await faberAgent.wallet.delete()
      await aliceAgent.shutdown()
      await aliceAgent.wallet.delete()
    })

    test('Alice starts with proof proposal to Faber, both with autoAcceptProof on `always`', async () => {
      testLogger.test('Alice sends presentation proposal to Faber')

      await aliceAgent.proofs.proposeProof({
        connectionId: aliceConnection.id,
        protocolVersion: 'v2',
        proofFormats: {
          indy: {
            name: 'abc',
            version: '1.0',
            attributes: presentationPreview.attributes,
            predicates: presentationPreview.predicates,
          },
        },
      })

      testLogger.test('Faber waits for presentation from Alice')
      testLogger.test('Alice waits till it receives presentation ack')
      await Promise.all([
        waitForProofExchangeRecord(faberAgent, { state: ProofState.Done }),
        waitForProofExchangeRecord(aliceAgent, { state: ProofState.Done }),
      ])
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

      await faberAgent.proofs.requestProof({
        protocolVersion: 'v2',
        connectionId: faberConnection.id,
        proofFormats: {
          indy: {
            name: 'proof-request',
            version: '1.0',
            requestedAttributes: attributes,
            requestedPredicates: predicates,
          },
        },
      })

      testLogger.test('Alice waits for presentation from Faber')
      testLogger.test('Faber waits till it receives presentation ack')
      await Promise.all([
        waitForProofExchangeRecord(faberAgent, { state: ProofState.Done }),
        waitForProofExchangeRecord(aliceAgent, { state: ProofState.Done }),
      ])
    })
  })

  describe("Auto accept on 'contentApproved'", () => {
    beforeAll(async () => {
      testLogger.test('Initializing the agents')
      ;({ faberAgent, aliceAgent, credDefId, faberConnection, aliceConnection, presentationPreview } =
        await setupProofsTest(
          'Faber Auto Accept Content Approved Proofs',
          'Alice Auto Accept Content Approved Proofs',
          AutoAcceptProof.ContentApproved
        ))
    })
    afterAll(async () => {
      testLogger.test('Shutting down both agents')
      await faberAgent.shutdown()
      await faberAgent.wallet.delete()
      await aliceAgent.shutdown()
      await aliceAgent.wallet.delete()
    })

    test("Alice starts with proof proposal to Faber, both with autoAcceptProof on 'contentApproved'", async () => {
      testLogger.test('Alice sends presentation proposal to Faber')

      const faberProofExchangeRecordPromise = waitForProofExchangeRecord(faberAgent, {
        state: ProofState.ProposalReceived,
      })

      await aliceAgent.proofs.proposeProof({
        connectionId: aliceConnection.id,
        protocolVersion: 'v2',
        proofFormats: {
          indy: {
            attributes: presentationPreview.attributes,
            predicates: presentationPreview.predicates,
            name: 'abc',
            version: '1.0',
          },
        },
      })

      const faberProofExchangeRecord = await faberProofExchangeRecordPromise
      await faberAgent.proofs.acceptProposal({
        proofRecordId: faberProofExchangeRecord.id,
      })

      await Promise.all([
        waitForProofExchangeRecord(aliceAgent, { state: ProofState.Done }),
        waitForProofExchangeRecord(faberAgent, { state: ProofState.Done }),
      ])
    })

    test("Faber starts with proof requests to Alice, both with autoAcceptProof on 'contentApproved'", async () => {
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
        state: ProofState.RequestReceived,
      })

      await faberAgent.proofs.requestProof({
        protocolVersion: 'v2',
        connectionId: faberConnection.id,
        proofFormats: {
          indy: {
            name: 'proof-request',
            version: '1.0',
            requestedAttributes: attributes,
            requestedPredicates: predicates,
          },
        },
      })

      const aliceProofExchangeRecord = await aliceProofExchangeRecordPromise
      await aliceAgent.proofs.acceptRequest({
        proofRecordId: aliceProofExchangeRecord.id,
      })

      await Promise.all([
        waitForProofExchangeRecord(faberAgent, { state: ProofState.Done }),
        waitForProofExchangeRecord(aliceAgent, { state: ProofState.Done }),
      ])
    })
  })
})
