import type { Agent, ConnectionRecord } from '../src'
import type {
  AcceptProposalOptions,
  ProposeProofOptions,
  RequestProofsOptions,
} from '../src/modules/proofs/models/ModuleOptions'
import type { PresentationPreview } from '../src/modules/proofs/models/PresentationPreview'

import {
  AutoAcceptProof,
  ProofState,
  ProofAttributeInfo,
  AttributeFilter,
  ProofPredicateInfo,
  PredicateType,
} from '../src'
import { ProofProtocolVersion } from '../src/modules/proofs/models/ProofProtocolVersion'

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

      const proposeProofOptions: ProposeProofOptions = {
        connectionId: aliceConnection.id,
        protocolVersion: ProofProtocolVersion.V2_0,
        proofFormats: {
          indy: {
            nonce: '1298236324864',
            proofPreview: presentationPreview,
            name: 'abc',
            version: '1.0',
          },
        },
      }

      const aliceProofRecord = await aliceAgent.proofs.proposeProof(proposeProofOptions)

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

      const requestProofsOptions: RequestProofsOptions = {
        protocolVersion: ProofProtocolVersion.V2_0,
        connectionId: faberConnection.id,
        proofRequestOptions: {
          indy: {
            name: 'proof-request',
            version: '1.0',
            nonce: '1298236324864',
            requestedAttributes: attributes,
            requestedPredicates: predicates,
          },
        },
      }

      const faberProofRecord = await faberAgent.proofs.requestProof(requestProofsOptions)
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

    test('Alice starts with proof proposal to Faber, both with autoacceptproof on `contentApproved`', async () => {
      testLogger.test('Alice sends presentation proposal to Faber')

      const proposal: ProposeProofOptions = {
        connectionId: aliceConnection.id,
        protocolVersion: ProofProtocolVersion.V2_0,
        proofFormats: {
          indy: {
            nonce: '1298236324864',
            proofPreview: presentationPreview,
            name: 'abc',
            version: '1.0',
          },
        },
      }

      const aliceProofRecord = await aliceAgent.proofs.proposeProof(proposal)

      testLogger.test('Faber waits for presentation proposal from Alice')

      const faberProofRecord = await waitForProofRecord(faberAgent, {
        threadId: aliceProofRecord.threadId,
        state: ProofState.ProposalReceived,
      })

      testLogger.test('Faber accepts presentation proposal from Alice')

      const acceptProposalOptions: AcceptProposalOptions = {
        proofFormats: {
          indy: {
            name: 'proof-request',
            version: '1.0',
            nonce: '1298236324864',
            attributes: presentationPreview.attributes,
            predicates: presentationPreview.predicates,
          },
        },
        proofRecordId: faberProofRecord.id,
        protocolVersion: ProofProtocolVersion.V2_0,
      }
      await faberAgent.proofs.acceptProposal(acceptProposalOptions)

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

      const requestProofsOptions: RequestProofsOptions = {
        protocolVersion: ProofProtocolVersion.V2_0,
        connectionId: faberConnection.id,
        proofRequestOptions: {
          indy: {
            name: 'proof-request',
            version: '1.0',
            nonce: '1298236324866',
            requestedAttributes: attributes,
            requestedPredicates: predicates,
          },
        },
      }

      const faberProofRecord = await faberAgent.proofs.requestProof(requestProofsOptions)

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
})
