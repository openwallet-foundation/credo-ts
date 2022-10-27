import type { Agent } from '../../../../../agent/Agent'
import type { ConnectionRecord } from '../../../../connections/repository/ConnectionRecord'
import type { AcceptProposalOptions, ProposeProofOptions } from '../../../ProofsApiOptions'
import type { ProofRecord } from '../../../repository/ProofRecord'
import type { SubmissionRequirement } from '@sphereon/pex-models'

import { setupProofsTest, waitForProofRecord } from '../../../../../../tests/helpers'
import testLogger from '../../../../../../tests/logger'
import { DidCommMessageRepository } from '../../../../../storage'
import {
  V2_PRESENTATION_EXCHANGE_PRESENTATION_PROPOSAL,
  V2_PRESENTATION_EXCHANGE_PRESENTATION_REQUEST,
} from '../../../formats/ProofFormats'
import { ProofProtocolVersion } from '../../../models/ProofProtocolVersion'
import { ProofState } from '../../../models/ProofState'
import { V2RequestPresentationMessage } from '../messages'
import { V2ProposalPresentationMessage } from '../messages/V2ProposalPresentationMessage'

describe('Present Proof', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let aliceConnection: ConnectionRecord
  let faberProofRecord: ProofRecord
  let aliceProofRecord: ProofRecord
  let didCommMessageRepository: DidCommMessageRepository

  const inputDescriptor =
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

    beforeAll(async () => {
      testLogger.test('Initializing the agents')
        ; ({ faberAgent, aliceAgent, aliceConnection } = await setupProofsTest('Faber agent', 'Alice agent'))
    })

  afterAll(async () => {
    testLogger.test('Shutting down both agents')
    await faberAgent.shutdown()
    await faberAgent.wallet.delete()
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
  })

  test(`Alice Creates and sends Proof Proposal to Faber`, async () => {
    testLogger.test('Alice sends proof proposal to Faber')

    const proposeOptions: ProposeProofOptions = {
      connectionId: aliceConnection.id,
      protocolVersion: ProofProtocolVersion.V2,
      proofFormats: {
        presentationExchange: {
          // this is of type PresentationDefinitionV1 (see pex library)
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

    const faberPresentationRecordPromise = waitForProofRecord(faberAgent, {
      state: ProofState.ProposalReceived,
    })

    aliceProofRecord = await aliceAgent.proofs.proposeProof(proposeOptions)

    testLogger.test('Faber waits for presentation from Alice')
    faberProofRecord = await faberPresentationRecordPromise

    didCommMessageRepository = faberAgent.injectionContainer.resolve<DidCommMessageRepository>(DidCommMessageRepository)

    const proposal = await didCommMessageRepository.findAgentMessage(faberAgent.context, {
      associatedRecordId: faberProofRecord.id,
      messageClass: V2ProposalPresentationMessage,
    })

    expect(proposal).toMatchObject({
      type: 'https://didcomm.org/present-proof/2.0/propose-presentation',
      formats: [
        {
          attachmentId: expect.any(String),
          format: V2_PRESENTATION_EXCHANGE_PRESENTATION_PROPOSAL,
        },
      ],
      proposalsAttach: [
        {
          id: expect.any(String),
          mimeType: 'application/json',
          data: {
            json: {
              input_descriptors: expect.any(Array),
            },
          },
        },
      ],
      id: expect.any(String),
      comment: 'V2 Presentation Exchange propose proof test',
    })
    expect(faberProofRecord.id).not.toBeNull()
    expect(faberProofRecord).toMatchObject({
      threadId: faberProofRecord.threadId,
      state: ProofState.ProposalReceived,
      protocolVersion: ProofProtocolVersion.V2,
    })
  })

  test(`Faber accepts the Proposal send by Alice`, async () => {
    // Accept Proposal
    const acceptProposalOptions: AcceptProposalOptions = {
      proofRecordId: faberProofRecord.id,
    }

    const alicePresentationRecordPromise = waitForProofRecord(aliceAgent, {
      threadId: faberProofRecord.threadId,
      state: ProofState.RequestReceived,
    })

    testLogger.test('Faber accepts presentation proposal from Alice')
    faberProofRecord = await faberAgent.proofs.acceptProposal(acceptProposalOptions)

    testLogger.test('Alice waits for proof request from Faber')
    aliceProofRecord = await alicePresentationRecordPromise

    didCommMessageRepository = faberAgent.injectionContainer.resolve<DidCommMessageRepository>(DidCommMessageRepository)

    const request = await didCommMessageRepository.findAgentMessage(faberAgent.context, {
      associatedRecordId: faberProofRecord.id,
      messageClass: V2RequestPresentationMessage,
    })

    expect(request).toMatchObject({
      type: 'https://didcomm.org/present-proof/2.0/request-presentation',
      id: expect.any(String),
      formats: [
        {
          attachmentId: expect.any(String),
          format: V2_PRESENTATION_EXCHANGE_PRESENTATION_REQUEST,
        },
      ],
      requestPresentationsAttach: [
        {
          id: expect.any(String),
          mimeType: 'application/json',
          data: {
            json: {
              options: {
                challenge: expect.any(String),
                domain: expect.any(String),
              },
              presentationDefinition: {
                id: expect.any(String),
                input_descriptors: [
                  {
                    id: expect.any(String),
                    name: expect.any(String),
                    group: expect.any(Array),
                    schema: expect.any(Array),
                    constraints: {
                      fields: expect.any(Array),
                    },
                  },
                ],
                // format: {
                //   ldpVc: {
                //     proofType: ['Ed25519Signature2018'],
                //   },
                // },
              },
            },
          },
        },
      ],
    })
    expect(aliceProofRecord).toMatchObject({
      id: expect.any(String),
      threadId: faberProofRecord.threadId,
      state: ProofState.RequestReceived,
      protocolVersion: ProofProtocolVersion.V2,
    })
  })

  xtest(`Submission Requirements`, async () => {
    {
      // Submission Requirements are an optional field within the presentation definition v1

      // export interface PresentationDefinitionV1 {
      //   id: string;
      //   name?: string;
      //   purpose?: string;
      //   format?: Format;
      //   submission_requirements?: Array<SubmissionRequirement>; // <----- HERE
      //   input_descriptors: Array<InputDescriptorV1>;
      // }
      const submissionRequirements: SubmissionRequirement[] = [
        {
          name: 'Banking Information',
          purpose: 'We need you to prove you currently hold a bank account older than 12months.',
          rule: 'pick',
          count: 1,
          from: 'A',
        },
        {
          name: 'Employment Information',
          purpose:
            'We are only verifying one current employment relationship, not any other information about employment.',
          rule: 'all',
          from: 'B',
        },
        {
          name: 'Citizenship Information',
          rule: 'pick',
          count: 1,
          from_nested: [
            {
              name: 'United States Citizenship Proofs',
              purpose: 'We need you to prove your US citizenship.',
              rule: 'all',
              from: 'C',
            },
            {
              name: 'European Union Citizenship Proofs',
              purpose: 'We need you to prove you are a citizen of an EU member state.',
              rule: 'pick',
              count: 1,
              from: 'D',
            },
          ],
        },
      ]

      let id1 = inputDescriptor
      let id2 = inputDescriptor
      let id3 = inputDescriptor
      let id4 = inputDescriptor

      id1.group = ['A']
      id1.group = ['B']
      id1.group = ['C']
      id1.group = ['D']

      const proposeOptions: ProposeProofOptions = {
        connectionId: aliceConnection.id,
        protocolVersion: ProofProtocolVersion.V2,
        proofFormats: {
          presentationExchange: {
            // this is of type PresentationDefinitionV1 (see pex library)
            presentationDefinition: {
              id: 'e950bfe5-d7ec-4303-ad61-6983fb976ac9',
              input_descriptors: [id1, id2, id3, id4],
              submission_requirements: submissionRequirements,
            },
          },
        },
        comment: 'V2 Presentation Exchange propose proof test',
      }
      const faberPresentationRecordPromise = waitForProofRecord(faberAgent, {
        state: ProofState.ProposalReceived,
      })
  
      aliceProofRecord = await aliceAgent.proofs.proposeProof(proposeOptions)
  
      testLogger.test('Faber waits for presentation from Alice')
      faberProofRecord = await faberPresentationRecordPromise
  
      didCommMessageRepository = faberAgent.injectionContainer.resolve<DidCommMessageRepository>(DidCommMessageRepository)
  
      const proposal = await didCommMessageRepository.findAgentMessage(faberAgent.context, {
        associatedRecordId: faberProofRecord.id,
        messageClass: V2ProposalPresentationMessage,
      })
    }
  })
})
