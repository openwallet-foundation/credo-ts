import type { EventReplaySubject } from '../../../../../../core/tests'
import type { AnonCredsTestsAgent } from '../../../../../tests/legacyAnonCredsSetup'

import { testLogger, waitForProofExchangeRecord } from '../../../../../../core/tests'
import { AutoAcceptProof, ProofState } from '../../../../../../didcomm/src'
import { issueLegacyAnonCredsCredential, setupAnonCredsTests } from '../../../../../tests/legacyAnonCredsSetup'

describe('Auto accept present proof', () => {
  let faberAgent: AnonCredsTestsAgent
  let faberReplay: EventReplaySubject
  let aliceAgent: AnonCredsTestsAgent
  let aliceReplay: EventReplaySubject
  let faberConnectionId: string
  let aliceConnectionId: string
  let credentialDefinitionId: string

  describe("Auto accept on 'always'", () => {
    beforeAll(async () => {
      ;({
        issuerAgent: faberAgent,
        issuerReplay: faberReplay,
        holderAgent: aliceAgent,
        holderReplay: aliceReplay,
        credentialDefinitionId,
        issuerHolderConnectionId: faberConnectionId,
        holderIssuerConnectionId: aliceConnectionId,
      } = await setupAnonCredsTests({
        issuerName: 'Faber Auto Accept Always Proofs',
        holderName: 'Alice Auto Accept Always Proofs',
        autoAcceptProofs: AutoAcceptProof.Always,
        attributeNames: ['name', 'age'],
      }))

      await issueLegacyAnonCredsCredential({
        issuerAgent: faberAgent,
        issuerReplay: faberReplay,
        holderAgent: aliceAgent,
        holderReplay: aliceReplay,
        issuerHolderConnectionId: faberConnectionId,
        offer: {
          credentialDefinitionId,
          attributes: [
            { name: 'name', value: 'John' },
            { name: 'age', value: '99' },
          ],
        },
      })
    })
    afterAll(async () => {
      await faberAgent.shutdown()
      await aliceAgent.shutdown()
    })

    test("Alice starts with proof proposal to Faber, both with autoAcceptProof on 'always'", async () => {
      testLogger.test('Alice sends presentation proposal to Faber')

      await aliceAgent.didcomm.proofs.proposeProof({
        connectionId: aliceConnectionId,
        protocolVersion: 'v1',
        proofFormats: {
          indy: {
            name: 'abc',
            version: '1.0',
            attributes: [
              {
                name: 'name',
                value: 'John',
                credentialDefinitionId,
              },
            ],
            predicates: [
              {
                name: 'age',
                predicate: '>=',
                threshold: 50,
                credentialDefinitionId,
              },
            ],
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

    test("Faber starts with proof requests to Alice, both with autoAcceptProof on 'always'", async () => {
      testLogger.test('Faber sends presentation request to Alice')

      await faberAgent.didcomm.proofs.requestProof({
        protocolVersion: 'v1',
        connectionId: faberConnectionId,
        proofFormats: {
          indy: {
            name: 'proof-request',
            version: '1.0',
            requested_attributes: {
              name: {
                name: 'name',
                restrictions: [
                  {
                    cred_def_id: credentialDefinitionId,
                  },
                ],
              },
            },
            requested_predicates: {
              age: {
                name: 'age',
                p_type: '>=',
                p_value: 50,
                restrictions: [
                  {
                    cred_def_id: credentialDefinitionId,
                  },
                ],
              },
            },
          },
        },
      })

      testLogger.test('Faber waits for presentation from Alice')
      await Promise.all([
        waitForProofExchangeRecord(faberAgent, { state: ProofState.Done }),
        waitForProofExchangeRecord(aliceAgent, { state: ProofState.Done }),
      ])
    })
  })

  describe("Auto accept on 'contentApproved'", () => {
    beforeAll(async () => {
      testLogger.test('Initializing the agents')
      ;({
        issuerAgent: faberAgent,
        issuerReplay: faberReplay,
        holderAgent: aliceAgent,
        holderReplay: aliceReplay,
        credentialDefinitionId,
        issuerHolderConnectionId: faberConnectionId,
        holderIssuerConnectionId: aliceConnectionId,
      } = await setupAnonCredsTests({
        issuerName: 'Faber Auto Accept ContentApproved Proofs',
        holderName: 'Alice Auto Accept ContentApproved Proofs',
        autoAcceptProofs: AutoAcceptProof.ContentApproved,
        attributeNames: ['name', 'age'],
      }))

      await issueLegacyAnonCredsCredential({
        issuerAgent: faberAgent,
        issuerReplay: faberReplay,
        holderAgent: aliceAgent,
        holderReplay: aliceReplay,
        issuerHolderConnectionId: faberConnectionId,
        offer: {
          credentialDefinitionId,
          attributes: [
            { name: 'name', value: 'John' },
            { name: 'age', value: '99' },
          ],
        },
      })
    })
    afterAll(async () => {
      testLogger.test('Shutting down both agents')
      await faberAgent.shutdown()
      await aliceAgent.shutdown()
    })

    test("Alice starts with proof proposal to Faber, both with autoAcceptProof on 'contentApproved'", async () => {
      testLogger.test('Alice sends presentation proposal to Faber')

      const aliceProofExchangeRecord = await aliceAgent.didcomm.proofs.proposeProof({
        connectionId: aliceConnectionId,
        protocolVersion: 'v1',
        proofFormats: {
          indy: {
            name: 'abc',
            version: '1.0',
            attributes: [
              {
                name: 'name',
                value: 'John',
                credentialDefinitionId,
              },
            ],
            predicates: [
              {
                name: 'age',
                predicate: '>=',
                threshold: 50,
                credentialDefinitionId,
              },
            ],
          },
        },
      })

      testLogger.test('Faber waits for presentation proposal from Alice')
      const faberProofExchangeRecord = await waitForProofExchangeRecord(faberAgent, {
        threadId: aliceProofExchangeRecord.threadId,
        state: ProofState.ProposalReceived,
      })

      testLogger.test('Faber accepts presentation proposal from Alice')
      await faberAgent.didcomm.proofs.acceptProposal({ proofRecordId: faberProofExchangeRecord.id })

      await Promise.all([
        waitForProofExchangeRecord(aliceAgent, { state: ProofState.Done }),
        waitForProofExchangeRecord(faberAgent, { state: ProofState.Done }),
      ])
    })

    test("Faber starts with proof requests to Alice, both with autoAcceptProof on 'contentApproved'", async () => {
      testLogger.test('Faber sends presentation request to Alice')

      await faberAgent.didcomm.proofs.requestProof({
        protocolVersion: 'v1',
        connectionId: faberConnectionId,
        proofFormats: {
          indy: {
            name: 'proof-request',
            version: '1.0',
            requested_attributes: {
              name: {
                name: 'name',
                restrictions: [
                  {
                    cred_def_id: credentialDefinitionId,
                  },
                ],
              },
            },
            requested_predicates: {
              age: {
                name: 'age',
                p_type: '>=',
                p_value: 50,
                restrictions: [
                  {
                    cred_def_id: credentialDefinitionId,
                  },
                ],
              },
            },
          },
        },
      })

      testLogger.test('Alice waits for request from Faber')
      const { id: proofRecordId } = await waitForProofExchangeRecord(aliceAgent, {
        state: ProofState.RequestReceived,
      })

      const { proofFormats } = await aliceAgent.didcomm.proofs.selectCredentialsForRequest({ proofRecordId })
      await aliceAgent.didcomm.proofs.acceptRequest({ proofRecordId, proofFormats })

      await Promise.all([
        waitForProofExchangeRecord(aliceAgent, { state: ProofState.Done }),
        waitForProofExchangeRecord(faberAgent, { state: ProofState.Done }),
      ])
    })
  })
})
