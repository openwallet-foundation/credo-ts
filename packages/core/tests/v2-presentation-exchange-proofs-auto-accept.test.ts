import type { Agent, ConnectionRecord } from '../src'
import type { ProposeProofOptions, RequestProofOptions } from '../src/modules/proofs/models/ModuleOptions'

import { AutoAcceptProof, ProofState } from '../src'
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
            presentationDefinition: {
              id: 'e950bfe5-d7ec-4303-ad61-6983fb976ac9',
              input_descriptors: [
                {
                  constraints: {
                    fields: [
                      {
                        path: ['$.credentialSubject.familyName'],
                        purpose: 'The claim must be from one of the specified issuers',
                        id: '1f44d55f-f161-4938-a659-f8026467f126',
                      },
                      {
                        path: ['$.credentialSubject.givenName'],
                        purpose: 'The claim must be from one of the specified issuers',
                      },
                    ],
                    // limit_disclosure: 'required',
                    // is_holder: [
                    //   {
                    //     directive: 'required',
                    //     field_id: ['1f44d55f-f161-4938-a659-f8026467f126'],
                    //   },
                    // ],
                  },
                  schema: [
                    {
                      uri: 'https://www.w3.org/2018/credentials#VerifiableCredential',
                    },
                    {
                      uri: 'https://w3id.org/citizenship#PermanentResident',
                    },
                    {
                      uri: 'https://w3id.org/citizenship/v1',
                    },
                  ],
                  name: "EU Driver's License",
                  group: ['A'],
                  id: 'citizenship_input_1',
                },
              ],
            },
          },
        },
        comment: 'V2 Presentation Exchange propose proof test',
      }

      const aliceProofRecordPromise = waitForProofRecord(aliceAgent, {
        state: ProofState.Done,
        timeoutMs: 200000, // Temporary I have increased timeout as, verify presentation takes time to fetch the data from documentLoader
      })

      const faberProofRecordPromise = waitForProofRecord(faberAgent, {
        state: ProofState.Done,
        timeoutMs: 200000, // Temporary I have increased timeout as, verify presentation takes time to fetch the data from documentLoader
      })

      await aliceAgent.proofs.proposeProof(proposeProofOptions)

      testLogger.test('Faber waits for presentation from Alice')
      await faberProofRecordPromise

      testLogger.test('Alice waits till it receives presentation ack')
      await aliceProofRecordPromise
    })

    test('Faber starts with proof requests to Alice, both with autoAcceptProof on `always`', async () => {
      testLogger.test('Faber sends presentation request to Alice')

      const requestProofsOptions: RequestProofOptions = {
        protocolVersion: ProofProtocolVersion.V2,
        connectionId: faberConnection.id,
        proofFormats: {
          presentationExchange: {
            options: {
              challenge: 'e950bfe5-d7ec-4303-ad61-6983fb976ac9',
              domain: '',
            },
            presentationDefinition: {
              id: 'e950bfe5-d7ec-4303-ad61-6983fb976ac9',
              input_descriptors: [
                {
                  constraints: {
                    fields: [
                      {
                        path: ['$.credentialSubject.familyName'],
                        purpose: 'The claim must be from one of the specified issuers',
                        id: '1f44d55f-f161-4938-a659-f8026467f126',
                      },
                      {
                        path: ['$.credentialSubject.givenName'],
                        purpose: 'The claim must be from one of the specified issuers',
                      },
                    ],
                    // limit_disclosure: 'required',
                    // is_holder: [
                    //   {
                    //     directive: 'required',
                    //     field_id: ['1f44d55f-f161-4938-a659-f8026467f126'],
                    //   },
                    // ],
                  },
                  schema: [
                    {
                      uri: 'https://www.w3.org/2018/credentials#VerifiableCredential',
                    },
                    {
                      uri: 'https://w3id.org/citizenship#PermanentResident',
                    },
                    {
                      uri: 'https://w3id.org/citizenship/v1',
                    },
                  ],
                  name: "EU Driver's License",
                  group: ['A'],
                  id: 'citizenship_input_1',
                },
              ],
            },
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
            presentationDefinition: {
              id: 'e950bfe5-d7ec-4303-ad61-6983fb976ac9',
              input_descriptors: [
                {
                  constraints: {
                    fields: [
                      {
                        path: ['$.credentialSubject.familyName'],
                        purpose: 'The claim must be from one of the specified issuers',
                        id: '1f44d55f-f161-4938-a659-f8026467f126',
                      },
                      {
                        path: ['$.credentialSubject.givenName'],
                        purpose: 'The claim must be from one of the specified issuers',
                      },
                    ],
                    // limit_disclosure: 'required',
                    // is_holder: [
                    //   {
                    //     directive: 'required',
                    //     field_id: ['1f44d55f-f161-4938-a659-f8026467f126'],
                    //   },
                    // ],
                  },
                  schema: [
                    {
                      uri: 'https://www.w3.org/2018/credentials#VerifiableCredential',
                    },
                    {
                      uri: 'https://w3id.org/citizenship#PermanentResident',
                    },
                    {
                      uri: 'https://w3id.org/citizenship/v1',
                    },
                  ],
                  name: "EU Driver's License",
                  group: ['A'],
                  id: 'citizenship_input_1',
                },
              ],
            },
          },
        },
        comment: 'V2 Presentation Exchange propose proof test',
      }

      const faberProofRecordPromise = waitForProofRecord(faberAgent, {
        state: ProofState.Done,
        timeoutMs: 200000, // Temporary I have increased timeout as, verify presentation takes time to fetch the data from documentLoader
      })

      const aliceProofRecordPromise = waitForProofRecord(aliceAgent, {
        state: ProofState.Done,
        timeoutMs: 200000, // Temporary I have increased timeout as, verify presentation takes time to fetch the data from documentLoader
      })

      await aliceAgent.proofs.proposeProof(proposeProofOptions)

      await faberProofRecordPromise
      // Alice waits till it receives presentation ack
      await aliceProofRecordPromise
    })

    test('Faber starts with proof requests to Alice, both with autoacceptproof on `contentApproved`', async () => {
      testLogger.test('Faber sends presentation request to Alice')

      const requestProofsOptions: RequestProofOptions = {
        protocolVersion: ProofProtocolVersion.V2,
        connectionId: faberConnection.id,
        proofFormats: {
          presentationExchange: {
            options: {
              challenge: 'e950bfe5-d7ec-4303-ad61-6983fb976ac9',
              domain: '',
            },
            presentationDefinition: {
              id: 'e950bfe5-d7ec-4303-ad61-6983fb976ac9',
              input_descriptors: [
                {
                  constraints: {
                    fields: [
                      {
                        path: ['$.credentialSubject.familyName'],
                        purpose: 'The claim must be from one of the specified issuers',
                        id: '1f44d55f-f161-4938-a659-f8026467f126',
                      },
                      {
                        path: ['$.credentialSubject.givenName'],
                        purpose: 'The claim must be from one of the specified issuers',
                      },
                    ],
                    // limit_disclosure: 'required',
                    // is_holder: [
                    //   {
                    //     directive: 'required',
                    //     field_id: ['1f44d55f-f161-4938-a659-f8026467f126'],
                    //   },
                    // ],
                  },
                  schema: [
                    {
                      uri: 'https://www.w3.org/2018/credentials#VerifiableCredential',
                    },
                    {
                      uri: 'https://w3id.org/citizenship#PermanentResident',
                    },
                    {
                      uri: 'https://w3id.org/citizenship/v1',
                    },
                  ],
                  name: "EU Driver's License",
                  group: ['A'],
                  id: 'citizenship_input_1',
                },
              ],
            },
          },
        },
      }

      const faberProofRecordPromise = waitForProofRecord(faberAgent, {
        state: ProofState.Done,
        timeoutMs: 200000, // Temporary I have increased timeout as, verify presentation takes time to fetch the data from documentLoader
      })

      const aliceProofRecordPromise = waitForProofRecord(aliceAgent, {
        state: ProofState.Done,
        timeoutMs: 200000, // Temporary I have increased timeout as, verify presentation takes time to fetch the data from documentLoader
      })

      await faberAgent.proofs.requestProof(requestProofsOptions)

      testLogger.test('Faber waits for presentation from Alice')
      await faberProofRecordPromise

      // Alice waits till it receives presentation ack
      await aliceProofRecordPromise
    })
  })
})
