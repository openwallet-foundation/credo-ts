import type { AgentContext } from '../../../../../agent'
import type { Agent } from '../../../../../agent/Agent'
import type { ConnectionRecord } from '../../../../connections/repository/ConnectionRecord'
import type { ProposeProofOptions } from '../../../ProofsApiOptions'
import type { ProofRecord } from '../../../repository/ProofRecord'
import type { PresentationPreview } from '../models/V1PresentationPreview'

import { getAgentContext, setupProofsTest, waitForProofRecord } from '../../../../../../tests/helpers'
import testLogger from '../../../../../../tests/logger'
import { DidCommMessageRepository } from '../../../../../storage'
import { ProofProtocolVersion } from '../../../models/ProofProtocolVersion'
import { ProofState } from '../../../models/ProofState'
import { V1ProposePresentationMessage } from '../messages'

describe('Present Proof', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let aliceConnection: ConnectionRecord
  let presentationPreview: PresentationPreview
  let faberProofRecord: ProofRecord
  let didCommMessageRepository: DidCommMessageRepository
  let agentContext: AgentContext

  beforeAll(async () => {
    testLogger.test('Initializing the agents')
    ;({ faberAgent, aliceAgent, aliceConnection, presentationPreview } = await setupProofsTest(
      'Faber agent',
      'Alice agent'
    ))
    agentContext = getAgentContext()
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
      protocolVersion: ProofProtocolVersion.V1,
      proofFormats: {
        indy: {
          name: 'ProofRequest',
          nonce: '58d223e5-fc4d-4448-b74c-5eb11c6b558f',
          version: '1.0',
          attributes: presentationPreview.attributes,
          predicates: presentationPreview.predicates,
        },
      },
      comment: 'V1 propose proof test',
    }

    const faberProofRecordPromise = waitForProofRecord(faberAgent, {
      state: ProofState.ProposalReceived,
    })

    await aliceAgent.proofs.proposeProof(proposeOptions)

    testLogger.test('Faber waits for presentation from Alice')
    faberProofRecord = await faberProofRecordPromise

    didCommMessageRepository = faberAgent.injectionContainer.resolve<DidCommMessageRepository>(DidCommMessageRepository)

    const proposal = await didCommMessageRepository.findAgentMessage(faberAgent.context, {
      associatedRecordId: faberProofRecord.id,
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

    expect(faberProofRecord).toMatchObject({
      id: expect.anything(),
      threadId: faberProofRecord.threadId,
      state: ProofState.ProposalReceived,
      protocolVersion: ProofProtocolVersion.V1,
    })
  })
})
