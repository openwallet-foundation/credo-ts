import type { Agent } from '../../../../../agent/Agent'
import type { ConnectionRecord } from '../../../../connections/repository/ConnectionRecord'
import type { ProofExchangeRecord } from '../../../repository/ProofExchangeRecord'

import { setupJsonLdProofsTest, waitForProofExchangeRecord } from '../../../../../../tests/helpers'
import testLogger from '../../../../../../tests/logger'
import { TEST_INPUT_DESCRIPTORS_CITIZENSHIP } from '../../../__tests__/fixtures'
import { ProofState } from '../../../models/ProofState'

describe('Present Proof', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let aliceConnection: ConnectionRecord
  let faberProofExchangeRecord: ProofExchangeRecord
  let aliceProofExchangeRecord: ProofExchangeRecord

  beforeAll(async () => {
    testLogger.test('Initializing the agents')
    ;({ faberAgent, aliceAgent, aliceConnection } = await setupJsonLdProofsTest(
      'Faber Agent v2 PEX present proof format data',
      'Alice Agent v2 PEX present proof format data'
    ))
  })

  afterAll(async () => {
    testLogger.test('Shutting down both agents')
    await faberAgent.shutdown()
    await faberAgent.wallet.delete()
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
  })

  test(`Format Data`, async () => {
    testLogger.test('Alice sends proof proposal to Faber')

    let faberPresentationRecordPromise = waitForProofExchangeRecord(faberAgent, {
      state: ProofState.ProposalReceived,
    })

    aliceProofExchangeRecord = await aliceAgent.proofs.proposeProof({
      connectionId: aliceConnection.id,
      protocolVersion: 'v2',
      proofFormats: {
        presentationExchange: {
          presentationDefinition: {
            id: 'e950bfe5-d7ec-4303-ad61-6983fb976ac9',
            input_descriptors: [TEST_INPUT_DESCRIPTORS_CITIZENSHIP],
          },
        },
      },
      comment: 'V2 Presentation Exchange propose proof test',
    })

    testLogger.test('Faber waits for presentation from Alice')
    faberProofExchangeRecord = await faberPresentationRecordPromise

    // Accept Proposal
    const acceptProposalOptions = {
      proofRecordId: faberProofExchangeRecord.id,
    }

    const alicePresentationRecordPromise = waitForProofExchangeRecord(aliceAgent, {
      threadId: faberProofExchangeRecord.threadId,
      state: ProofState.RequestReceived,
    })

    testLogger.test('Faber accepts presentation proposal from Alice')
    faberProofExchangeRecord = await faberAgent.proofs.acceptProposal(acceptProposalOptions)

    testLogger.test('Alice waits for proof request from Faber')
    aliceProofExchangeRecord = await alicePresentationRecordPromise

    // Alice retrieves the requested credentials and accepts the presentation request
    testLogger.test('Alice accepts presentation request from Faber')

    const requestedCredentials = await aliceAgent.proofs.autoSelectCredentialsForProofRequest({
      proofRecordId: aliceProofExchangeRecord.id,
      config: {
        filterByPresentationPreview: true,
      },
    })

    const acceptPresentationOptions = {
      proofRecordId: aliceProofExchangeRecord.id,
      proofFormats: { presentationExchange: requestedCredentials.proofFormats.presentationExchange },
    }

    faberPresentationRecordPromise = waitForProofExchangeRecord(faberAgent, {
      threadId: aliceProofExchangeRecord.threadId,
      state: ProofState.PresentationReceived,
      timeoutMs: 200000, // Temporary I have increased timeout as, verify presentation takes time to fetch the data from documentLoader
    })

    await aliceAgent.proofs.acceptRequest(acceptPresentationOptions)

    // Faber waits for the presentation from Alice
    testLogger.test('Faber waits for presentation from Alice')
    faberProofExchangeRecord = await faberPresentationRecordPromise

    const aliceProofExchangeRecordPromise = waitForProofExchangeRecord(aliceAgent, {
      threadId: aliceProofExchangeRecord.threadId,
      state: ProofState.Done,
      timeoutMs: 200000, // Temporary I have increased timeout as, verify presentation takes time to fetch the data from documentLoader
    })

    // Faber accepts the presentation provided by Alice
    testLogger.test('Faber accepts the presentation provided by Alice')
    await faberAgent.proofs.acceptPresentation(faberProofExchangeRecord.id)

    // Alice waits until she received a presentation acknowledgement
    testLogger.test('Alice waits until she receives a presentation acknowledgement')
    aliceProofExchangeRecord = await aliceProofExchangeRecordPromise

    const formatData = await faberAgent.proofs.getFormatData(faberProofExchangeRecord.id)

    // note this presentation contains two credentials
    expect(formatData).toMatchObject({
      proposal: {
        presentationExchange: {
          id: 'e950bfe5-d7ec-4303-ad61-6983fb976ac9',
          input_descriptors: [
            {
              name: "EU Driver's License",
              group: ['A'],
              id: 'citizenship_input_1',
            },
          ],
        },
      },
      request: {
        presentationExchange: {
          options: {
            challenge: expect.any(String),
          },
          presentationDefinition: {
            id: expect.any(String),
          },
        },
      },
      presentation: {
        presentationExchange: {
          '@context': [
            'https://www.w3.org/2018/credentials/v1',
            'https://identity.foundation/presentation-exchange/submission/v1',
          ],
          holder: 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
          type: ['VerifiablePresentation', 'PresentationSubmission'],
          presentation_submission: {
            definition_id: 'e950bfe5-d7ec-4303-ad61-6983fb976ac9',
            descriptor_map: [
              {
                format: 'ldp_vc',
                id: 'citizenship_input_1',
                path: '$.verifiableCredential[0]',
              },
              {
                format: 'ldp_vc',
                id: 'citizenship_input_1',
                path: '$.verifiableCredential[1]',
              },
            ],
            id: expect.any(String),
          },
          verifiableCredential: [
            {
              '@context': [
                'https://www.w3.org/2018/credentials/v1',
                'https://w3id.org/citizenship/v1',
                'https://w3id.org/security/bbs/v1',
              ],
              credentialSubject: {
                birthCountry: 'Bahamas',
                birthDate: '1958-07-17',
                commuterClassification: 'C1',
                description: 'Government of Example Permanent Resident Card.',
                familyName: 'SMITH',
                gender: 'Male',
                givenName: 'JOHN',
                id: 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
                image: 'data:image/png;base64,iVBORw0KGgokJggg==',
                lprCategory: 'C09',
                lprNumber: '999-999-999',
                residentSince: '2015-01-01',
                type: ['PermanentResident', 'Person'],
              },
              expirationDate: '2029-12-03T12:19:52Z',
              id: expect.any(String),
              identifier: '83627465',
              issuanceDate: '2019-12-03T12:19:52Z',
              issuer: 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
              name: 'Permanent Resident Card',
              proof: {
                verificationMethod:
                  'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL#z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
                type: 'Ed25519Signature2018',
                created: expect.any(String),
                proofPurpose: 'assertionMethod',
                jws: expect.any(String),
              },
              type: ['VerifiableCredential', 'PermanentResidentCard'],
            },
            {
              '@context': [
                'https://www.w3.org/2018/credentials/v1',
                'https://w3id.org/citizenship/v1',
                'https://w3id.org/security/bbs/v1',
              ],
              credentialSubject: {
                birthCountry: 'Bahamas',
                birthDate: '1958-07-17',
                commuterClassification: 'C1',
                description: 'Government of Example Permanent Resident Card.',
                familyName: 'SMITH',
                gender: 'Male',
                givenName: 'JOHN',
                id: 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
                image: 'data:image/png;base64,iVBORw0KGgokJggg==',
                lprCategory: 'C09',
                lprNumber: '999-999-999',
                residentSince: '2015-01-01',
                type: ['PermanentResident', 'Person'],
              },
              expirationDate: '2029-12-03T12:19:52Z',
              id: expect.any(String),
              identifier: '83627465',
              issuanceDate: '2019-12-03T12:19:52Z',
              issuer: 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
              name: 'Permanent Resident Card',
              proof: {
                created: expect.any(String),
                jws: expect.any(String),
                proofPurpose: 'assertionMethod',
                type: 'Ed25519Signature2018',
                verificationMethod:
                  'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL#z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
              },
            },
          ],
          proof: {
            verificationMethod:
              'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL#z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
            type: 'Ed25519Signature2018',
            created: expect.any(String),
            proofPurpose: 'authentication',
            challenge: expect.any(String),
            jws: expect.any(String),
          },
        },
      },
    })
  })
})
