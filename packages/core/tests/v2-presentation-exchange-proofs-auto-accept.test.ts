import type { Agent, ConnectionRecord } from '../src'
import type { InputDescriptors } from '../src/modules/proofs/formats/presentation-exchange/models/InputDescriptors'
import type {
  AcceptProposalOptions,
  ProposeProofOptions,
  RequestProofOptions,
} from '../src/modules/proofs/models/ModuleOptions'

import { AutoAcceptProof, ProofState } from '../src'
import { PresentationDefinition } from '../src/modules/proofs/formats/presentation-exchange/models/RequestPresentation'
import { ProofProtocolVersion } from '../src/modules/proofs/models/ProofProtocolVersion'

import { setupV2ProofsTest, waitForProofRecord } from './helpers'
import testLogger from './logger'

describe('Auto accept present proof', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let faberConnection: ConnectionRecord
  let aliceConnection: ConnectionRecord

  describe('Auto accept on `always`', () => {
    beforeAll(async () => {
      ;({ faberAgent, aliceAgent, faberConnection, aliceConnection } = await setupV2ProofsTest(
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
        protocolVersion: ProofProtocolVersion.V2,
        proofFormats: {
          presentationExchange: {
            inputDescriptors: [
              {
                id: 'citizenship_input',
                name: 'US Passport',
                group: ['A'],
                schema: [
                  {
                    uri: 'https://w3id.org/citizenship/v1',
                  },
                ],
                constraints: {
                  fields: [
                    {
                      path: ['$.credentialSubject.birth_date', '$.vc.credentialSubject.birth_date', '$.birth_date'],
                      filter: {
                        type: 'date',
                        minimum: '1999-5-16',
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
        comment: 'V2 Presentation Exchange propose proof test',
      }
      const aliceProofRecord = await aliceAgent.proofs.proposeProof(proposeProofOptions)

      testLogger.test('Faber waits for presentation from Alice')
      await waitForProofRecord(faberAgent, {
        threadId: aliceProofRecord.threadId,
        state: ProofState.Done,
        timeoutMs: 200000, // Temporary I have increased timeout as, verify presentation takes time to fetch the data from documentLoader
      })

      testLogger.test('Alice waits till it receives presentation ack')
      await waitForProofRecord(aliceAgent, {
        threadId: aliceProofRecord.threadId,
        state: ProofState.Done,
        timeoutMs: 200000, // Temporary I have increased timeout as, verify presentation takes time to fetch the data from documentLoader
      })
    })

    test('Faber starts with proof requests to Alice, both with autoAcceptProof on `always`', async () => {
      testLogger.test('Faber sends presentation request to Alice')

      const inputDescriptors: InputDescriptors[] = [
        {
          id: 'citizenship_input',
          name: 'US Passport',
          group: ['A'],
          schema: [
            {
              uri: 'https://w3id.org/citizenship/v1',
            },
          ],
          constraints: {
            fields: [
              {
                path: ['$.credentialSubject.birth_date', '$.vc.credentialSubject.birth_date', '$.birth_date'],
                filter: {
                  type: 'date',
                  minimum: '1999-5-16',
                },
              },
            ],
          },
        },
      ]

      const presentationDefinition: PresentationDefinition = new PresentationDefinition({
        inputDescriptors,
        format: {
          ldpVc: {
            proofType: ['Ed25519Signature2018'],
          },
        },
      })

      const requestProofsOptions: RequestProofOptions = {
        protocolVersion: ProofProtocolVersion.V2,
        connectionId: faberConnection.id,
        proofFormats: {
          presentationExchange: {
            options: {
              challenge: 'e950bfe5-d7ec-4303-ad61-6983fb976ac9',
              domain: '',
            },
            presentationDefinition,
          },
        },
      }

      const faberProofRecord = await faberAgent.proofs.requestProof(requestProofsOptions)
      testLogger.test('Faber waits for presentation from Alice')
      await waitForProofRecord(faberAgent, {
        threadId: faberProofRecord.threadId,
        state: ProofState.Done,
        timeoutMs: 200000, // Temporary I have increased timeout as, verify presentation takes time to fetch the data from documentLoader
      })
      // Alice waits till it receives presentation ack
      await waitForProofRecord(aliceAgent, {
        threadId: faberProofRecord.threadId,
        state: ProofState.Done,
        timeoutMs: 200000, // Temporary I have increased timeout as, verify presentation takes time to fetch the data from documentLoader
      })
    })
  })

  describe('Auto accept on `contentApproved`', () => {
    beforeAll(async () => {
      testLogger.test('Initializing the agents')
      ;({ faberAgent, aliceAgent, faberConnection, aliceConnection } = await setupV2ProofsTest(
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

      const proposeProofOptions: ProposeProofOptions = {
        connectionId: aliceConnection.id,
        protocolVersion: ProofProtocolVersion.V2,
        proofFormats: {
          presentationExchange: {
            inputDescriptors: [
              {
                id: 'citizenship_input',
                name: 'US Passport',
                group: ['A'],
                schema: [
                  {
                    uri: 'https://w3id.org/citizenship/v1',
                  },
                ],
                constraints: {
                  fields: [
                    {
                      path: ['$.credentialSubject.birth_date', '$.vc.credentialSubject.birth_date', '$.birth_date'],
                      filter: {
                        type: 'date',
                        minimum: '1999-5-16',
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
        comment: 'V2 Presentation Exchange propose proof test',
      }

      const aliceProofRecord = await aliceAgent.proofs.proposeProof(proposeProofOptions)

      testLogger.test('Faber waits for presentation proposal from Alice')

      const faberProofRecord = await waitForProofRecord(faberAgent, {
        threadId: aliceProofRecord.threadId,
        state: ProofState.ProposalReceived,
      })

      testLogger.test('Faber accepts presentation proposal from Alice')

      const acceptProposalOptions: AcceptProposalOptions = {
        config: {
          name: 'proof-request',
          version: '1.0',
        },
        proofRecordId: faberProofRecord.id,
      }

      await faberAgent.proofs.acceptProposal(acceptProposalOptions)

      testLogger.test('Faber waits for presentation from Alice')

      await waitForProofRecord(faberAgent, {
        threadId: aliceProofRecord.threadId,
        state: ProofState.Done,
        timeoutMs: 200000, // Temporary I have increased timeout as, verify presentation takes time to fetch the data from documentLoader
      })
      // Alice waits till it receives presentation ack
      await waitForProofRecord(aliceAgent, {
        threadId: aliceProofRecord.threadId,
        state: ProofState.Done,
        timeoutMs: 200000, // Temporary I have increased timeout as, verify presentation takes time to fetch the data from documentLoader
      })
    })

    test('Faber starts with proof requests to Alice, both with autoacceptproof on `contentApproved`', async () => {
      testLogger.test('Faber sends presentation request to Alice')

      const inputDescriptors: InputDescriptors[] = [
        {
          id: 'citizenship_input',
          name: 'US Passport',
          group: ['A'],
          schema: [
            {
              uri: 'https://w3id.org/citizenship/v1',
            },
          ],
          constraints: {
            fields: [
              {
                path: ['$.credentialSubject.birth_date', '$.vc.credentialSubject.birth_date', '$.birth_date'],
                filter: {
                  type: 'date',
                  minimum: '1999-5-16',
                },
              },
            ],
          },
        },
      ]

      const presentationDefinition: PresentationDefinition = new PresentationDefinition({
        inputDescriptors,
        format: {
          ldpVc: {
            proofType: ['Ed25519Signature2018'],
          },
        },
      })

      const requestProofsOptions: RequestProofOptions = {
        protocolVersion: ProofProtocolVersion.V2,
        connectionId: faberConnection.id,
        proofFormats: {
          presentationExchange: {
            options: {
              challenge: 'e950bfe5-d7ec-4303-ad61-6983fb976ac9',
              domain: '',
            },
            presentationDefinition,
          },
        },
      }

      const faberProofRecord = await faberAgent.proofs.requestProof(requestProofsOptions)

      testLogger.test('Faber waits for presentation from Alice')
      await waitForProofRecord(faberAgent, {
        threadId: faberProofRecord.threadId,
        state: ProofState.Done,
        timeoutMs: 200000, // Temporary I have increased timeout as, verify presentation takes time to fetch the data from documentLoader
      })

      // Alice waits till it receives presentation ack
      await waitForProofRecord(aliceAgent, {
        threadId: faberProofRecord.threadId,
        state: ProofState.Done,
        timeoutMs: 200000, // Temporary I have increased timeout as, verify presentation takes time to fetch the data from documentLoader
      })
    })
  })
})
