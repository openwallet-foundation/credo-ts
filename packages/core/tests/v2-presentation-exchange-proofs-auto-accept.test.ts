import type { Agent, ConnectionRecord } from '../src'
import type { SubmissionRequirement } from '@sphereon/pex-models'

import { AutoAcceptProof, ProofState } from '../src'

import { setupJsonLdProofsTest, setupJsonLdProofsTestMultipleCredentials, waitForProofExchangeRecord } from './helpers'
import testLogger from './logger'

describe('Auto accept present proof', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let faberConnection: ConnectionRecord
  let aliceConnection: ConnectionRecord

  // Input_descriptors define the fields to be requested in a presentation definition for a given credential
  // submission_requirements specify combinations of input descriptors to allow multiple credentials
  // to be retrieved

  // query is based on matching the schema uri in the credential with that of the input descriptor g

  const inputDescriptorCitizenship = {
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
    },
    schema: [
      {
        uri: 'https://www.w3.org/2018/credentials/v1',
      },
      {
        uri: 'https://www.w3.org/2018/credentials#VerifiableCredential',
      },
      {
        uri: 'https://w3id.org/citizenship#PermanentResident',
      },
      {
        uri: 'https://w3id.org/citizenship/v1',
      },
      {
        uri: 'https://w3id.org/security/bbs/v1',
      },
    ],
    name: "EU Driver's License 1",
    group: ['A'],
    id: 'citizenship_input_1',
  }

  // To use in Submission Request tests
  const inputDescriptorVaccine = {
    name: 'EU Vaccine Passport',
    group: ['B'],
    id: 'vaccine_input_1',
    purpose: 'The claim must be from one of the specified issuers',
    constraints: {
      fields: [
        {
          path: ['$.credentialSubject.recipient.familyName'],
        },
        {
          path: ['$.credentialSubject.recipient.givenName'],
        },
      ],
    },
    schema: [
      {
        uri: 'https://www.w3.org/2018/credentials/v1',
      },
      {
        uri: 'https://www.w3.org/2018/credentials#VerifiableCredential',
      },
      {
        uri: 'https://w3id.org/vaccination#VaccineRecipient",',
      },
      {
        uri: 'https://w3id.org/vaccination/v1',
      },
    ],
  }
  describe('Auto accept on `always`', () => {
    // beforeAll(async () => {
    //   ;({ faberAgent, aliceAgent, faberConnection, aliceConnection } = await setupJsonLdProofsTestMultipleCredentials(
    //     'Faber Auto Accept Always Proofs',
    //     'Alice Auto Accept Always Proofs',
    //     AutoAcceptProof.Always
    //   ))
    // })
    afterAll(async () => {
      await faberAgent.shutdown()
      await faberAgent.wallet.delete()
      await aliceAgent.shutdown()
      await aliceAgent.wallet.delete()
    })

    xtest('Alice starts with proof proposal to Faber, both with autoAcceptProof on `always`', async () => {
      const { faberAgent, aliceAgent, aliceConnection } = await setupJsonLdProofsTest(
        'Faber Auto Accept Always Proofs',
        'Alice Auto Accept Always Proofs',
        AutoAcceptProof.Always
      )
      testLogger.test('Alice sends presentation proposal to Faber')

      const aliceProofExchangeRecordPromise = waitForProofExchangeRecord(aliceAgent, {
        state: ProofState.Done,
      })

      const faberProofExchangeRecordPromise = waitForProofExchangeRecord(faberAgent, {
        state: ProofState.Done,
      })

      await aliceAgent.proofs.proposeProof({
        connectionId: aliceConnection.id,
        protocolVersion: 'v2',
        proofFormats: {
          presentationExchange: {
            presentationDefinition: {
              id: 'e950bfe5-d7ec-4303-ad61-6983fb976ac9',
              input_descriptors: [inputDescriptorCitizenship],
            },
          },
        },
        comment: 'V2 Presentation Exchange propose proof test',
      })

      testLogger.test('Faber waits for presentation from Alice')
      await faberProofExchangeRecordPromise

      testLogger.test('Alice waits till it receives presentation ack')
      await aliceProofExchangeRecordPromise
    })

    xtest('Faber starts with proof requests to Alice, both with autoAcceptProof on `always`', async () => {
      const { faberAgent, aliceAgent, faberConnection } = await setupJsonLdProofsTest(
        'Faber Auto Accept Always Proofs',
        'Alice Auto Accept Always Proofs',
        AutoAcceptProof.Always
      )
      testLogger.test('Faber sends presentation request to Alice')

      const faberProofExchangeRecord = await faberAgent.proofs.requestProof({
        protocolVersion: 'v2',
        connectionId: faberConnection.id,
        proofFormats: {
          presentationExchange: {
            options: {
              challenge: 'e950bfe5-d7ec-4303-ad61-6983fb976ac9',
              domain: '',
            },
            presentationDefinition: {
              id: 'e950bfe5-d7ec-4303-ad61-6983fb976ac9',
              input_descriptors: [inputDescriptorCitizenship],
            },
          },
        },
      })
      testLogger.test('Faber waits for presentation from Alice')
      await waitForProofExchangeRecord(faberAgent, {
        threadId: faberProofExchangeRecord.threadId,
        state: ProofState.Done,
      })
      // Alice waits till it receives presentation ack
      await waitForProofExchangeRecord(aliceAgent, {
        threadId: faberProofExchangeRecord.threadId,
        state: ProofState.Done,
      })
    })

    test('Submission Requirements', async () => {
      const { faberAgent, aliceAgent, aliceConnection } = await setupJsonLdProofsTestMultipleCredentials(
        'Faber Auto Accept Always Proofs',
        'Alice Auto Accept Always Proofs',
        AutoAcceptProof.Always
      )
      testLogger.test('Alice sends presentation proposal to Faber')

      const submissionRequirements: SubmissionRequirement[] = [
        {
          name: 'Driving License Information',
          purpose: 'We need you to prove you currently hold a valid drivers license.',
          rule: 'pick',
          count: 1,
          from: 'A',
        },
        {
          name: 'Vaccine Information',
          purpose: 'We are only verifying one current vaccination.',
          rule: 'all',
          from: 'B',
        },
        // {
        //   name: 'Citizenship Information',
        //   rule: 'pick',
        //   count: 1,
        //   from_nested: [
        //     {
        //       name: 'United States Citizenship Proofs',
        //       purpose: 'We need you to prove your US citizenship.',
        //       rule: 'all',
        //       from: 'C',
        //     },
        //     {
        //       name: 'European Union Citizenship Proofs',
        //       purpose: 'We need you to prove you are a citizen of an EU member state.',
        //       rule: 'pick',
        //       count: 1,
        //       from: 'D',
        //     },
        //   ],
        // },
      ]

      const aliceProofExchangeRecordPromise = waitForProofExchangeRecord(aliceAgent, {
        state: ProofState.Done,
      })

      const faberProofExchangeRecordPromise = waitForProofExchangeRecord(faberAgent, {
        state: ProofState.Done,
      })

      await aliceAgent.proofs.proposeProof({
        connectionId: aliceConnection.id,
        protocolVersion: 'v2',
        proofFormats: {
          presentationExchange: {
            // this is of type PresentationDefinitionV1 (see pex library)
            presentationDefinition: {
              id: 'e950bfe5-d7ec-4303-ad61-6983fb976ac9',
              input_descriptors: [inputDescriptorCitizenship, inputDescriptorVaccine],
              submission_requirements: submissionRequirements,
            },
          },
        },
        comment: 'V2 Presentation Exchange propose proof test',
      })

      testLogger.test('Faber waits for presentation from Alice')
      await faberProofExchangeRecordPromise

      testLogger.test('Alice waits till it receives presentation ack')
      await aliceProofExchangeRecordPromise
    })
  })

  xdescribe('Auto accept on `contentApproved`', () => {
    beforeAll(async () => {
      testLogger.test('Initializing the agents')
      ;({ faberAgent, aliceAgent, faberConnection, aliceConnection } = await setupJsonLdProofsTest(
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
          presentationExchange: {
            presentationDefinition: {
              id: 'e950bfe5-d7ec-4303-ad61-6983fb976ac9',
              input_descriptors: [inputDescriptorCitizenship],
            },
          },
        },
        comment: 'V2 Presentation Exchange propose proof test',
      })

      await faberProofExchangeRecordPromise
      // Alice waits till it receives presentation ack
      await aliceProofExchangeRecordPromise
    })

    test('Faber starts with proof requests to Alice, both with autoacceptproof on `contentApproved`', async () => {
      testLogger.test('Faber sends presentation request to Alice')

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
          presentationExchange: {
            options: {
              challenge: 'e950bfe5-d7ec-4303-ad61-6983fb976ac9',
              domain: '',
            },
            presentationDefinition: {
              id: 'e950bfe5-d7ec-4303-ad61-6983fb976ac9',
              input_descriptors: [inputDescriptorCitizenship],
            },
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
