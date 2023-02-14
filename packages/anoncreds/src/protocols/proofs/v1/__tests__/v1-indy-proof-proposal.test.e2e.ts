import type { Agent } from '../../../../../agent/Agent'
import type { ConnectionRecord } from '../../../../connections/repository/ConnectionRecord'
import type { ProofExchangeRecord } from '../../../repository/ProofExchangeRecord'
import type { V1PresentationPreview } from '../models/V1PresentationPreview'

import { setupProofsTest, waitForProofExchangeRecord } from '../../../../../../tests/helpers'
import testLogger from '../../../../../../tests/logger'
import { DidCommMessageRepository } from '../../../../../storage'
import { ProofState } from '../../../models/ProofState'
import { V1ProposePresentationMessage } from '../messages'

describe('Present Proof', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let aliceConnection: ConnectionRecord
  let presentationPreview: V1PresentationPreview
  let faberProofExchangeRecord: ProofExchangeRecord
  let didCommMessageRepository: DidCommMessageRepository

  beforeAll(async () => {
    testLogger.test('Initializing the agents')
    ;({ faberAgent, aliceAgent, aliceConnection, presentationPreview } = await setupProofsTest(
      'Faber agent',
      'Alice agent'
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

    const faberProofExchangeRecordPromise = waitForProofExchangeRecord(faberAgent, {
      state: ProofState.ProposalReceived,
    })

    await aliceAgent.proofs.proposeProof({
      connectionId: aliceConnection.id,
      protocolVersion: 'v1',
      proofFormats: {
        indy: {
          name: 'ProofRequest',
          version: '1.0',
          attributes: presentationPreview.attributes,
          predicates: presentationPreview.predicates,
        },
      },
      comment: 'V1 propose proof test',
    })

    testLogger.test('Faber waits for presentation from Alice')
    faberProofExchangeRecord = await faberProofExchangeRecordPromise

    didCommMessageRepository = faberAgent.dependencyManager.resolve<DidCommMessageRepository>(DidCommMessageRepository)

    const proposal = await didCommMessageRepository.findAgentMessage(faberAgent.context, {
      associatedRecordId: faberProofExchangeRecord.id,
      messageClass: V1ProposePresentationMessage,
    })

    expect(proposal).toMatchObject({
      type: 'https://didcomm.org/present-proof/1.0/propose-presentation',
      id: expect.any(String),
      comment: 'V1 propose proof test',
      presentationProposal: {
        type: 'https://didcomm.org/present-proof/1.0/presentation-preview',
        attributes: [
          {
            name: 'name',
            credentialDefinitionId: presentationPreview.attributes[0].credentialDefinitionId,
            value: 'John',
            referent: '0',
          },
          {
            name: 'image_0',
            credentialDefinitionId: presentationPreview.attributes[1].credentialDefinitionId,
          },
        ],
        predicates: [
          {
            name: 'age',
            credentialDefinitionId: presentationPreview.predicates[0].credentialDefinitionId,
            predicate: '>=',
            threshold: 50,
          },
        ],
      },
    })

    expect(faberProofExchangeRecord).toMatchObject({
      id: expect.anything(),
      threadId: faberProofExchangeRecord.threadId,
      state: ProofState.ProposalReceived,
      protocolVersion: 'v1',
    })
  })
})
