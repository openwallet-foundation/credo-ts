import type { Agent, ConnectionRecord } from '../src'
import type { PresentationPreview } from '../src/modules/proofs/PresentationPreview'
import type { ProposeProofOptions } from '../src/modules/proofs/v2/interface'

import {
  AutoAcceptProof,
  ProofState,
  ProofAttributeInfo,
  AttributeFilter,
  ProofPredicateInfo,
  PredicateType,
} from '../src'
import { ProofProtocolVersion } from '../src/modules/proofs/ProofProtocolVersion'

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

      const proposal: ProposeProofOptions = {
        connectionId: aliceConnection.id,
        protocolVersion: ProofProtocolVersion.V1_0,
        proofFormats: {
          indy: {
            nonce: '58d223e5-fc4d-4448-b74c-5eb11c6b558f',
            proofPreview: presentationPreview,
            name: 'age',
            version: '1.0',
          },
        },
        autoAcceptProof: AutoAcceptProof.Always,
      }

      const alicePresExchRecord = await aliceAgent.proofs.proposeProof(proposal)

      console.log('test case alicePresExchRecord threadid', alicePresExchRecord)

      testLogger.test('Faber waits for presentation from Alice')
      await waitForProofRecord(faberAgent, {
        threadId: alicePresExchRecord.threadId,
        state: ProofState.Done,
      })

      testLogger.test('Alice waits till it receives presentation ack')
      await waitForProofRecord(aliceAgent, {
        threadId: alicePresExchRecord.threadId,
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
        await setupProofsTest(
          'Faber Auto Accept Content Approved Proofs',
          'Alice Auto Accept Content Approved Proofs',
          AutoAcceptProof.ContentApproved
        ))
    })

    afterAll(async () => {
      await faberAgent.shutdown()
      await faberAgent.wallet.delete()
      await aliceAgent.shutdown()
      await aliceAgent.wallet.delete()
    })

    test('Alice starts with proof proposal to Faber, both with autoacceptproof on `contentApproved`', async () => {
      testLogger.test('Alice sends presentation proposal to Faber')
      const proposal: ProposeProofOptions = {
        connectionId: aliceConnection.id,
        protocolVersion: ProofProtocolVersion.V1_0,
        proofFormats: {
          indy: {
            nonce: '58d223e5-fc4d-4448-b74c-5eb11c6b558f',
            proofPreview: presentationPreview,
            name: 'abc',
            version: '1.0',
          },
        },
      }
      const alicePresExchRecord = await aliceAgent.proofs.proposeProof(proposal)

      testLogger.test('Faber waits for presentation proposal from Alice')
      const faberProofRecord = await waitForProofRecord(faberAgent, {
        threadId: alicePresExchRecord.threadId,
        state: ProofState.ProposalReceived,
      })

      testLogger.test('Faber accepts presentation proposal from Alice')
      await faberAgent.proofs.acceptProposal(faberProofRecord.id)

      testLogger.test('Faber waits for presentation from Alice')
      await waitForProofRecord(faberAgent, {
        threadId: alicePresExchRecord.threadId,
        state: ProofState.Done,
      })

      // Alice waits till it receives presentation ack
      await waitForProofRecord(aliceAgent, {
        threadId: alicePresExchRecord.threadId,
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
      const retrievedCredentials = await aliceAgent.proofs.getRequestedCredentialsForProofRequest(
        ProofProtocolVersion.V1_0,
        aliceProofRecord.id,
        {
          filterByPresentationPreview: true,
        }
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
