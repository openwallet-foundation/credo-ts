import type { Agent, ConnectionRecord } from '../src'

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

  describe('Auto accept on `always`', () => {
    // beforeAll(async () => {
    //   ;({ faberAgent, aliceAgent, faberConnection, aliceConnection } = await setupJsonLdProofsTestMultipleCredentials(
    //     'Faber Auto Accept Always Proofs',
    //     'Alice Auto Accept Always Proofs',
    //     AutoAcceptProof.Always
    //   ))
    // })
    afterAll(async () => {
      if (faberAgent) {
        await faberAgent.shutdown()
        await faberAgent.wallet.delete()
      }
      if (aliceAgent) {
        await aliceAgent.shutdown()
        await aliceAgent.wallet.delete()
      }
    })

    test('Alice starts with proof proposal to Faber, both with autoAcceptProof on `always`', async () => {
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

    test('Faber starts with proof requests to Alice, both with autoAcceptProof on `always`', async () => {
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
              input_descriptors: [
                {
                  id: 'vaccine_input_1',
                  name: 'Vaccine Information',
                  purpose: 'We need your Vaccine information.',
                  group: ['A'],
                  schema: [
                    {
                      uri: 'https://w3id.org/vaccination/v1',
                    },
                  ],
                },
                {
                  id: 'citizenship_input_1',
                  name: 'Residency Information',
                  purpose: 'We need your Residency information.',
                  group: ['B'],
                  schema: [
                    {
                      uri: 'https://w3id.org/citizenship/v1',
                    },
                  ],
                },
                {
                  id: 'citizenship_input_2',
                  name: 'Residency Information',
                  purpose: 'We need your Residency information.',
                  group: ['B'],
                  schema: [
                    {
                      uri: 'https://w3id.org/citizenship/v2',
                    },
                  ],
                },
              ],
              submission_requirements: [
                {
                  name: 'Vaccine Information',
                  purpose: 'We need to know if you are vaccinated',
                  rule: 'all',
                  from: 'A',
                },
                {
                  name: 'Citizenship Information',
                  purpose: 'We need to know if you are a resident',
                  rule: 'pick',
                  count: 1,
                  from: 'B',
                },
              ],
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

    xtest('Submission Requirements Version 2 (using PEX example config)', async () => {
      const { faberAgent, aliceAgent, aliceConnection } = await setupJsonLdProofsTestMultipleCredentials(
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
            // this is of type PresentationDefinitionV1 (see pex library)
            presentationDefinition: {
              id: '32f54163-7166-48f1-93d8-ff217bdb0653',
              input_descriptors: [
                {
                  id: 'vaccine_input_1',
                  name: 'Vaccine Information',
                  purpose: 'We need your Vaccine information.',
                  group: ['A'],
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
                  constraints: {
                    limit_disclosure: 'required',
                    fields: [
                      {
                        path: ['$.issuer', '$.vc.issuer', '$.iss'],
                        purpose: 'The claim must be from one of the specified issuers',
                        filter: {
                          type: 'string',
                          pattern: 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
                        },
                      },
                      {
                        path: [
                          '$.credentialSubject.recipient.giveName',
                          '$.credentialSubject.recipient.familyName',
                          '$.credentialSubject.batchNumber',
                          // '$.vc.credentialSubject.account[*].account_number',
                          // '$.account[*].account_number',
                        ],
                        purpose: 'We need your batch number for processing purposes',
                        filter: {
                          type: 'string',
                          minLength: 10,
                          maxLength: 12,
                        },
                      },
                    ],
                  },
                },
                // {
                //   id: 'banking_input_2',
                //   name: 'Bank Account Information',
                //   purpose: 'We need your bank and account information.',
                //   group: ['A'],
                //   schema: [
                //     {
                //       uri: 'https://bank-schemas.org/1.0.0/accounts.json',
                //     },
                //     {
                //       uri: 'https://bank-schemas.org/2.0.0/accounts.json',
                //     },
                //   ],
                //   constraints: {
                //     fields: [
                //       {
                //         path: ['$.issuer', '$.vc.issuer', '$.iss'],
                //         purpose: 'The claim must be from one of the specified issuers',
                //         filter: {
                //           type: 'string',
                //           pattern: 'did:example:123|did:example:456',
                //         },
                //       },
                //       {
                //         path: [
                //           '$.credentialSubject.account[*].id',
                //           '$.vc.credentialSubject.account[*].id',
                //           '$.account[*].id',
                //         ],
                //         purpose: 'We need your bank account number for processing purposes',
                //         filter: {
                //           type: 'string',
                //           minLength: 10,
                //           maxLength: 12,
                //         },
                //       },
                //       {
                //         path: [
                //           '$.credentialSubject.account[*].route',
                //           '$.vc.credentialSubject.account[*].route',
                //           '$.account[*].route',
                //         ],
                //         purpose: 'You must have an account with a German, US, or Japanese bank account',
                //         filter: {
                //           type: 'string',
                //           pattern: '^DE|^US|^JP',
                //         },
                //       },
                //     ],
                //   },
                // },
                // {
                //   id: 'employment_input',
                //   name: 'Employment History',
                //   purpose: 'We need to know your work history.',
                //   group: ['B'],
                //   schema: [
                //     {
                //       uri: 'https://business-standards.org/schemas/employment-history.json',
                //     },
                //   ],
                //   constraints: {
                //     fields: [
                //       {
                //         path: ['$.jobs[*].active'],
                //         filter: {
                //           type: 'boolean',
                //           pattern: 'true',
                //         },
                //       },
                //     ],
                //   },
                // },
                // {
                //   id: 'citizenship_input_1',
                //   name: "EU Driver's License",
                //   group: ['C'],
                //   schema: [
                //     {
                //       uri: 'https://eu.com/claims/DriversLicense.json',
                //     },
                //   ],
                //   constraints: {
                //     fields: [
                //       {
                //         path: ['$.issuer', '$.vc.issuer', '$.iss'],
                //         purpose: 'The claim must be from one of the specified issuers',
                //         filter: {
                //           type: 'string',
                //           pattern: 'did:example:gov1|did:example:gov2',
                //         },
                //       },
                //       {
                //         path: ['$.credentialSubject.dob', '$.vc.credentialSubject.dob', '$.dob'],
                //         filter: {
                //           type: 'string',
                //           format: 'date',
                //           minimum: '1999-5-16',
                //         },
                //       },
                //     ],
                //   },
                // },
                // {
                //   id: 'citizenship_input_2',
                //   name: 'US Passport',
                //   group: ['C'],
                //   schema: [
                //     {
                //       uri: 'hub://did:foo:123/Collections/schema.us.gov/passport.json',
                //     },
                //   ],
                //   constraints: {
                //     fields: [
                //       {
                //         path: ['$.credentialSubject.birth_date', '$.vc.credentialSubject.birth_date', '$.birth_date'],
                //         filter: {
                //           type: 'string',
                //           format: 'date',
                //           minimum: '1999-5-16',
                //         },
                //       },
                //     ],
                //   },
                // },
              ],
              submission_requirements: [
                {
                  name: 'Banking Information',
                  purpose: 'We need to know if you have an established banking history.',
                  rule: 'pick',
                  count: 1,
                  from: 'A',
                },
                // {
                //   name: 'Employment Information',
                //   purpose: 'We need to know that you are currently employed.',
                //   rule: 'all',
                //   from: 'B',
                // },
                // {
                //   name: 'Citizenship Information',
                //   rule: 'pick',
                //   count: 1,
                //   from: 'C',
                // },
              ],
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

  describe('Auto accept on `contentApproved`', () => {
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
