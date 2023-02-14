import type { Agent } from '../../../../../agent/Agent'
import type { ConnectionRecord } from '../../../../connections/repository/ConnectionRecord'
import type { ProofExchangeRecord } from '../../../repository'
import type { V1PresentationPreview } from '../../v1/models/V1PresentationPreview'

import { setupProofsTest, waitForProofExchangeRecord } from '../../../../../../tests/helpers'
import testLogger from '../../../../../../tests/logger'
import { DidCommMessageRepository } from '../../../../../storage'
import { ProofState } from '../../../models/ProofState'
import { V2ProposePresentationMessage } from '../messages/V2ProposePresentationMessage'

describe('Present Proof', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let aliceConnection: ConnectionRecord
  let presentationPreview: V1PresentationPreview
  let faberPresentationRecord: ProofExchangeRecord
  let didCommMessageRepository: DidCommMessageRepository

  beforeAll(async () => {
    testLogger.test('Initializing the agents')
    ;({ faberAgent, aliceAgent, aliceConnection, presentationPreview } = await setupProofsTest(
      'Faber agent v2',
      'Alice agent v2'
    ))
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

    await aliceAgent.proofs.proposeProof({
      connectionId: aliceConnection.id,
      protocolVersion: 'v2',
      proofFormats: {
        indy: {
          name: 'ProofRequest',
          version: '1.0',
          attributes: presentationPreview.attributes,
          predicates: presentationPreview.predicates,
        },
      },
      comment: 'V2 propose proof test',
    })

    testLogger.test('Faber waits for presentation from Alice')
    faberPresentationRecord = await faberPresentationRecordPromise

    didCommMessageRepository = faberAgent.dependencyManager.resolve<DidCommMessageRepository>(DidCommMessageRepository)

    const proposal = await didCommMessageRepository.findAgentMessage(faberAgent.context, {
      associatedRecordId: faberPresentationRecord.id,
      messageClass: V2ProposePresentationMessage,
    })

    expect(proposal).toMatchObject({
      type: 'https://didcomm.org/present-proof/2.0/propose-presentation',
      formats: [
        {
          attachmentId: expect.any(String),
          format: 'hlindy/proof-req@v2.0',
        },
      ],
      proposalAttachments: [
        {
          id: expect.any(String),
          mimeType: 'application/json',
          data: {
            base64: expect.any(String),
          },
        },
      ],
      id: expect.any(String),
      comment: 'V2 propose proof test',
    })
    expect(faberPresentationRecord).toMatchObject({
      id: expect.anything(),
      threadId: faberPresentationRecord.threadId,
      state: ProofState.ProposalReceived,
      protocolVersion: 'v2',
    })
  })
})
