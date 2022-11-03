import type { Agent, ConnectionRecord } from '../src'
import type { PresentationPreview } from '../src/modules/proofs/protocol/v1/models/V1PresentationPreview'

import {
  AutoAcceptProof,
  ProofState,
  ProofAttributeInfo,
  AttributeFilter,
  ProofPredicateInfo,
  PredicateType,
} from '../src'

import { setupIndyProofsTest, waitForProofExchangeRecord } from './helpers'
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
        await setupIndyProofsTest(
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

      const faberProofExchangeRecordPromise = waitForProofExchangeRecord(faberAgent, {
        state: ProofState.Done,
      })

      const aliceProofExchangeRecordPromise = waitForProofExchangeRecord(aliceAgent, {
        state: ProofState.Done,
      })

      await aliceAgent.proofs.proposeProof({
        connectionId: aliceConnection.id,
        protocolVersion: 'v2',
        proofFormats: {
          indy: {
            nonce: '1298236324864',
            name: 'abc',
            version: '1.0',
            attributes: presentationPreview.attributes,
            predicates: presentationPreview.predicates,
          },
        },
      })

      testLogger.test('Faber waits for presentation from Alice')
      await faberProofExchangeRecordPromise

      testLogger.test('Alice waits till it receives presentation ack')
      await aliceProofExchangeRecordPromise
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

      const faberProofExchangeRecordPromise = waitForProofExchangeRecord(faberAgent, {
        state: ProofState.Done,
      })

      const aliceProofExchangeRecordPromise = waitForProofExchangeRecord(aliceAgent, {
        state: ProofState.Done,
      })

      await faberAgent.proofs.requestProof({
        protocolVersion: 'v2',
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
      })

      testLogger.test('Faber waits for presentation from Alice')
      await faberProofExchangeRecordPromise
      // Alice waits till it receives presentation ack
      await aliceProofExchangeRecordPromise
    })
  })

  describe('Auto accept on `contentApproved`', () => {
    beforeAll(async () => {
      testLogger.test('Initializing the agents')
      ;({ faberAgent, aliceAgent, credDefId, faberConnection, aliceConnection, presentationPreview } =
        await setupIndyProofsTest(
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

    test('Alice starts with proof proposal to Faber, both with autoacceptproof on `contentApproved`', async () => {
      testLogger.test('Alice sends presentation proposal to Faber')

      let faberProofExchangeRecordPromise = waitForProofExchangeRecord(faberAgent, {
        state: ProofState.ProposalReceived,
      })

      const aliceProofExchangeRecord = await aliceAgent.proofs.proposeProof({
        connectionId: aliceConnection.id,
        protocolVersion: 'v2',
        proofFormats: {
          indy: {
            nonce: '1298236324864',
            attributes: presentationPreview.attributes,
            predicates: presentationPreview.predicates,
            name: 'abc',
            version: '1.0',
          },
        },
      })

      testLogger.test('Faber waits for presentation proposal from Alice')

      await faberProofExchangeRecordPromise

      testLogger.test('Faber accepts presentation proposal from Alice')

      faberProofExchangeRecordPromise = waitForProofExchangeRecord(faberAgent, {
        threadId: aliceProofExchangeRecord.threadId,
        state: ProofState.Done,
      })

      const aliceProofExchangeRecordPromise = waitForProofExchangeRecord(aliceAgent, {
        threadId: aliceProofExchangeRecord.threadId,
        state: ProofState.Done,
      })

      testLogger.test('Faber waits for presentation from Alice')

      await faberProofExchangeRecordPromise
      // Alice waits till it receives presentation ack
      await aliceProofExchangeRecordPromise
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

      const faberProofExchangeRecordPromise = waitForProofExchangeRecord(faberAgent, {
        state: ProofState.Done,
      })

      const aliceProofExchangeRecordPromise = waitForProofExchangeRecord(aliceAgent, {
        state: ProofState.Done,
      })

      await faberAgent.proofs.requestProof({
        protocolVersion: 'v2',
        connectionId: faberConnection.id,
        proofFormats: {
          indy: {
            name: 'proof-request',
            version: '1.0',
            nonce: '1298236324866',
            requestedAttributes: attributes,
            requestedPredicates: predicates,
          },
        },
      })

      testLogger.test('Faber waits for presentation from Alice')
      await faberProofExchangeRecordPromise

      // Alice waits till it receives presentation ack
      await aliceProofExchangeRecordPromise
    })
  })
})
