import type { Agent } from '../../../../../agent/Agent'
import type { ConnectionRecord } from '../../../../connections/repository/ConnectionRecord'
import type { ProposeProofOptions } from '../../../models/ModuleOptions'
import type { ProofRecord } from '../../../repository/ProofRecord'
import type { PresentationPreview } from '../models/PresentationPreview'

import { setupProofsTest, waitForProofRecord } from '../../../../../../tests/helpers'
import testLogger from '../../../../../../tests/logger'
import { ProofProtocolVersion } from '../../../models/ProofProtocolVersion'
import { ProofState } from '../../../models/ProofState'

describe('Present Proof', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let aliceConnection: ConnectionRecord
  let presentationPreview: PresentationPreview
  let faberPresentationRecord: ProofRecord
  let alicePresentationRecord: ProofRecord

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
    testLogger.test('Alice sends (v1) proof proposal to Faber')

    const proposeOptions: ProposeProofOptions = {
      connectionId: aliceConnection.id,
      protocolVersion: ProofProtocolVersion.V1_0,
      proofFormats: {
        indy: {
          name: 'ProofRequest',
          nonce: '58d223e5-fc4d-4448-b74c-5eb11c6b558f',
          version: '1.0',
          proofPreview: presentationPreview,
        },
      },
      comment: 'V1 propose proof test',
    }

    alicePresentationRecord = await aliceAgent.proofs.proposeProof(proposeOptions)

    testLogger.test('Faber waits for presentation from Alice')
    faberPresentationRecord = await waitForProofRecord(faberAgent, {
      threadId: alicePresentationRecord.threadId,
      state: ProofState.ProposalReceived,
    })

    expect(faberPresentationRecord.id).not.toBeNull()
    expect(faberPresentationRecord).toMatchObject({
      threadId: faberPresentationRecord.threadId,
      state: ProofState.ProposalReceived,
      protocolVersion: ProofProtocolVersion.V1_0,
    })
  })
})
