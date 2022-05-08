import type { Agent, ConnectionRecord, ProofRecord } from '../src'
import type { InputDescriptors } from '../src/modules/proofs/formats/presentation-exchange/models'
import type {
  AcceptPresentationOptions,
  AcceptProposalOptions,
  ProposeProofOptions,
  RequestProofOptions,
} from '../src/modules/proofs/models/ModuleOptions'
import type { PresentationPreview } from '../src/modules/proofs/protocol/v1/models/V1PresentationPreview'
import type { CredDefId } from 'indy-sdk'

import { ProofState } from '../src'
import {
  V2_PRESENTATION_EXCHANGE_PRESENTATION,
  V2_PRESENTATION_EXCHANGE_PRESENTATION_REQUEST,
} from '../src/modules/proofs/formats/ProofFormats'
import { PresentationDefinition } from '../src/modules/proofs/formats/presentation-exchange/models/RequestPresentation'
import { ProofProtocolVersion } from '../src/modules/proofs/models/ProofProtocolVersion'
import {
  V2PresentationMessage,
  V2ProposalPresentationMessage,
  V2RequestPresentationMessage,
} from '../src/modules/proofs/protocol/v2/messages'
import { DidCommMessageRepository } from '../src/storage/didcomm'

import { setupV2ProofsTest, waitForProofRecord } from './helpers'
import testLogger from './logger'

describe('Present Proof', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let credDefId: CredDefId
  let aliceConnection: ConnectionRecord
  let faberConnection: ConnectionRecord
  let faberProofRecord: ProofRecord
  let aliceProofRecord: ProofRecord
  let presentationPreview: PresentationPreview
  let didCommMessageRepository: DidCommMessageRepository

  beforeAll(async () => {
    testLogger.test('Initializing the agents')
    ;({ faberAgent, aliceAgent, credDefId, faberConnection, aliceConnection, presentationPreview } =
      await setupV2ProofsTest('Faber agent', 'Alice agent'))
  })

  afterAll(async () => {
    testLogger.test('Shutting down both agents')
    await faberAgent.shutdown()
    await faberAgent.wallet.delete()
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
  })

  test('Alice starts with proof proposal to Faber', async () => {
    // Alice sends a presentation proposal to Faber
    testLogger.test('Alice sends a presentation proposal to Faber')

    const proposeOptions: ProposeProofOptions = {
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

    aliceProofRecord = await aliceAgent.proofs.proposeProof(proposeOptions)

    // Faber waits for a presentation proposal from Alice
    testLogger.test('Faber waits for a presentation proposal from Alice')
    faberProofRecord = await waitForProofRecord(faberAgent, {
      threadId: aliceProofRecord.threadId,
      state: ProofState.ProposalReceived,
    })

    didCommMessageRepository = faberAgent.injectionContainer.resolve<DidCommMessageRepository>(DidCommMessageRepository)

    const proposal = await didCommMessageRepository.findAgentMessage({
      associatedRecordId: faberProofRecord.id,
      messageClass: V2ProposalPresentationMessage,
    })

    expect(proposal).toMatchObject({
      type: 'https://didcomm.org/present-proof/2.0/propose-presentation',
      formats: [
        {
          attachmentId: expect.any(String),
          format: V2_PRESENTATION_EXCHANGE_PRESENTATION_REQUEST,
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

    const acceptProposalOptions: AcceptProposalOptions = {
      config: {
        name: 'proof-request',
        version: '1.0',
      },
      proofRecordId: faberProofRecord.id,
    }

    // Faber accepts the presentation proposal from Alice
    testLogger.test('Faber accepts presentation proposal from Alice')
    faberProofRecord = await faberAgent.proofs.acceptProposal(acceptProposalOptions)

    // Alice waits for presentation request from Faber
    testLogger.test('Alice waits for presentation request from Faber')
    aliceProofRecord = await waitForProofRecord(aliceAgent, {
      threadId: aliceProofRecord.threadId,
      state: ProofState.RequestReceived,
    })

    const request = await didCommMessageRepository.findAgentMessage({
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
              presentation_definition: {
                input_descriptors: [
                  {
                    id: 'citizenship_input',
                    name: 'US Passport',
                    group: ['A'],
                    schema: [
                      {
                        uri: expect.any(String),
                      },
                    ],
                    constraints: {
                      fields: [
                        {
                          path: expect.any(Array),
                          filter: {
                            type: expect.any(String),
                            minimum: expect.any(String),
                          },
                        },
                      ],
                    },
                  },
                ],
                format: {
                  ldpVc: {
                    proofType: ['Ed25519Signature2018'],
                  },
                },
              },
            },
          },
        },
      ],
    })
    expect(aliceProofRecord.id).not.toBeNull()
    expect(aliceProofRecord).toMatchObject({
      threadId: faberProofRecord.threadId,
      state: ProofState.RequestReceived,
      protocolVersion: ProofProtocolVersion.V2,
    })

    // Alice retrieves the requested credentials and accepts the presentation request
    testLogger.test('Alice accepts presentation request from Faber')

    const requestedCredentials = await aliceAgent.proofs.autoSelectCredentialsForProofRequest({
      proofRecordId: aliceProofRecord.id,
      config: {
        filterByPresentationPreview: true,
      },
    })

    const acceptPresentationOptions: AcceptPresentationOptions = {
      proofRecordId: aliceProofRecord.id,
      proofFormats: { presentationExchange: requestedCredentials.presentationExchange },
    }
    aliceProofRecord = await aliceAgent.proofs.acceptRequest(acceptPresentationOptions)

    // Faber waits for the presentation from Alice
    testLogger.test('Faber waits for presentation from Alice')
    faberProofRecord = await waitForProofRecord(faberAgent, {
      threadId: aliceProofRecord.threadId,
      state: ProofState.PresentationReceived,
      timeoutMs: 200000,
    })

    const presentation = await didCommMessageRepository.findAgentMessage({
      associatedRecordId: faberProofRecord.id,
      messageClass: V2PresentationMessage,
    })

    expect(presentation).toMatchObject({
      type: 'https://didcomm.org/present-proof/2.0/presentation',
      formats: [
        {
          attachmentId: expect.any(String),
          format: V2_PRESENTATION_EXCHANGE_PRESENTATION,
        },
      ],
      presentationsAttach: [
        {
          id: expect.any(String),
          mimeType: 'application/json',
          data: {
            json: {
              '@context': expect.any(Array),
              type: expect.any(Array),
              verifiableCredential: expect.any(Array),
            },
          },
        },
      ],
      id: expect.any(String),
      thread: {
        threadId: faberProofRecord.threadId,
      },
    })
    expect(faberProofRecord.id).not.toBeNull()
    expect(faberProofRecord).toMatchObject({
      threadId: faberProofRecord.threadId,
      state: ProofState.PresentationReceived,
      protocolVersion: ProofProtocolVersion.V2,
    })

    // Faber accepts the presentation provided by Alice
    testLogger.test('Faber accepts the presentation provided by Alice')
    await faberAgent.proofs.acceptPresentation(faberProofRecord.id)

    // Alice waits until she received a presentation acknowledgement
    testLogger.test('Alice waits until she receives a presentation acknowledgement')
    aliceProofRecord = await waitForProofRecord(aliceAgent, {
      threadId: aliceProofRecord.threadId,
      state: ProofState.Done,
    })

    expect(faberProofRecord).toMatchObject({
      // type: ProofRecord.name,
      id: expect.any(String),
      createdAt: expect.any(Date),
      threadId: aliceProofRecord.threadId,
      connectionId: expect.any(String),
      isVerified: true,
      state: ProofState.PresentationReceived,
    })

    expect(aliceProofRecord).toMatchObject({
      // type: ProofRecord.name,
      id: expect.any(String),
      createdAt: expect.any(Date),
      threadId: faberProofRecord.threadId,
      connectionId: expect.any(String),
      state: ProofState.Done,
    })
  })

  test('Faber starts with proof request to Alice', async () => {
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

    // Faber sends a presentation request to Alice
    testLogger.test('Faber sends a presentation request to Alice')
    faberProofRecord = await faberAgent.proofs.requestProof(requestProofsOptions)

    // Alice waits for presentation request from Faber
    testLogger.test('Alice waits for presentation request from Faber')
    aliceProofRecord = await waitForProofRecord(aliceAgent, {
      threadId: faberProofRecord.threadId,
      state: ProofState.RequestReceived,
    })

    const request = await didCommMessageRepository.findAgentMessage({
      associatedRecordId: faberProofRecord.id,
      messageClass: V2RequestPresentationMessage,
    })

    // console.log('request', JSON.stringify(request, null, 2))

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
              presentation_definition: {
                input_descriptors: [
                  {
                    id: 'citizenship_input',
                    name: 'US Passport',
                    group: ['A'],
                    schema: [
                      {
                        uri: expect.any(String),
                      },
                    ],
                    constraints: {
                      fields: [
                        {
                          path: expect.any(Array),
                          filter: {
                            type: expect.any(String),
                            minimum: expect.any(String),
                          },
                        },
                      ],
                    },
                  },
                ],
                format: {
                  ldpVc: {
                    proofType: ['Ed25519Signature2018'],
                  },
                },
              },
            },
          },
        },
      ],
    })
    expect(aliceProofRecord.id).not.toBeNull()
    expect(aliceProofRecord).toMatchObject({
      threadId: faberProofRecord.threadId,
      state: ProofState.RequestReceived,
      protocolVersion: ProofProtocolVersion.V2,
    })

    // Alice retrieves the requested credentials and accepts the presentation request
    testLogger.test('Alice accepts presentation request from Faber')

    const requestedCredentials = await aliceAgent.proofs.autoSelectCredentialsForProofRequest({
      proofRecordId: aliceProofRecord.id,
      config: {
        filterByPresentationPreview: true,
      },
    })

    const acceptPresentationOptions: AcceptPresentationOptions = {
      proofRecordId: aliceProofRecord.id,
      proofFormats: { presentationExchange: requestedCredentials.presentationExchange },
    }

    aliceProofRecord = await aliceAgent.proofs.acceptRequest(acceptPresentationOptions)

    // Faber waits for the presentation from Alice
    testLogger.test('Faber waits for presentation from Alice')
    faberProofRecord = await waitForProofRecord(faberAgent, {
      threadId: aliceProofRecord.threadId,
      state: ProofState.PresentationReceived,
      timeoutMs: 200000,
    })

    const presentation = await didCommMessageRepository.findAgentMessage({
      associatedRecordId: faberProofRecord.id,
      messageClass: V2PresentationMessage,
    })

    expect(presentation).toMatchObject({
      type: 'https://didcomm.org/present-proof/2.0/presentation',
      formats: [
        {
          attachmentId: expect.any(String),
          format: V2_PRESENTATION_EXCHANGE_PRESENTATION,
        },
      ],
      presentationsAttach: [
        {
          id: expect.any(String),
          mimeType: 'application/json',
          data: {
            json: {
              '@context': expect.any(Array),
              type: expect.any(Array),
              verifiableCredential: expect.any(Array),
            },
          },
        },
      ],
      id: expect.any(String),
      thread: {
        threadId: faberProofRecord.threadId,
      },
    })
    expect(faberProofRecord.id).not.toBeNull()
    expect(faberProofRecord).toMatchObject({
      threadId: faberProofRecord.threadId,
      state: ProofState.PresentationReceived,
      protocolVersion: ProofProtocolVersion.V2,
    })

    // Faber accepts the presentation provided by Alice
    testLogger.test('Faber accepts the presentation provided by Alice')
    await faberAgent.proofs.acceptPresentation(faberProofRecord.id)

    // Alice waits until she received a presentation acknowledgement
    testLogger.test('Alice waits until she receives a presentation acknowledgement')
    aliceProofRecord = await waitForProofRecord(aliceAgent, {
      threadId: aliceProofRecord.threadId,
      state: ProofState.Done,
    })

    expect(faberProofRecord).toMatchObject({
      // type: ProofRecord.name,
      id: expect.any(String),
      createdAt: expect.any(Date),
      threadId: aliceProofRecord.threadId,
      connectionId: expect.any(String),
      isVerified: true,
      state: ProofState.PresentationReceived,
    })

    expect(aliceProofRecord).toMatchObject({
      // type: ProofRecord.name,
      id: expect.any(String),
      createdAt: expect.any(Date),
      threadId: faberProofRecord.threadId,
      connectionId: expect.any(String),
      state: ProofState.Done,
    })
  })
})
