import type { Agent } from '../../../../../agent/Agent'
import type { ConnectionRecord } from '../../../../connections/repository/ConnectionRecord'
import type { ProofExchangeRecord } from '../../../repository/ProofExchangeRecord'

import { setupProofsTest, waitForProofExchangeRecord } from '../../../../../../tests/helpers'
import testLogger from '../../../../../../tests/logger'
import { DidCommMessageRepository } from '../../../../../storage'
import {
  V2_PRESENTATION_EXCHANGE_PRESENTATION_PROPOSAL,
  V2_PRESENTATION_EXCHANGE_PRESENTATION_REQUEST,
} from '../../../formats/ProofFormats'
import { ProofState } from '../../../models/ProofState'
import { V2RequestPresentationMessage } from '../messages'
import { V2ProposalPresentationMessage } from '../messages/V2ProposalPresentationMessage'
import { TEST_INPUT_DESCRIPTORS_CITIZENSHIP } from '../../../__tests__/fixtures'

describe('Present Proof', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let aliceConnection: ConnectionRecord
  let faberProofRecord: ProofExchangeRecord
  let aliceProofRecord: ProofExchangeRecord
  let didCommMessageRepository: DidCommMessageRepository

  beforeAll(async () => {
    testLogger.test('Initializing the agents')
    ;({ faberAgent, aliceAgent, aliceConnection } = await setupProofsTest('Faber agent', 'Alice agent'))
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

    const faberPresentationRecordPromise = waitForProofExchangeRecord(faberAgent, {
      state: ProofState.ProposalReceived,
    })

    aliceProofRecord = await aliceAgent.proofs.proposeProof({
      connectionId: aliceConnection.id,
      protocolVersion: 'v2',
      proofFormats: {
        presentationExchange: {
          // this is of type PresentationDefinitionV1 (see pex library)
          presentationDefinition: {
            id: 'e950bfe5-d7ec-4303-ad61-6983fb976ac9',
            input_descriptors: [TEST_INPUT_DESCRIPTORS_CITIZENSHIP],
          },
        },
      },
      comment: 'V2 Presentation Exchange propose proof test',
    })

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
      protocolVersion: 'v2',
    })
  })

  test(`Faber accepts the Proposal send by Alice`, async () => {
    // Accept Proposal
    const acceptProposalOptions = {
      proofRecordId: faberProofRecord.id,
    }

    const alicePresentationRecordPromise = waitForProofExchangeRecord(aliceAgent, {
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
      protocolVersion: 'v2',
    })
  })
})
