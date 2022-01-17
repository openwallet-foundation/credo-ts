import type { Agent } from '../../../../agent/Agent'
import type { ConnectionRecord } from '../../../connections'
import type { ProposeProofOptions } from '../interface'
import type { CredDefId } from 'indy-sdk'

import { ProofState } from '../..'
import { setupProofsTest, waitForProofRecord } from '../../../../../tests/helpers'
import testLogger from '../../../../../tests/logger'
import {
  PresentationPreview,
  PresentationPreviewAttribute,
  PresentationPreviewPredicate,
} from '../../PresentationPreview'
import { ProofProtocolVersion } from '../../ProofProtocolVersion'
import { ProofRole } from '../ProofRole'

describe('Present Proof', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let credDefId: CredDefId
  // let faberConnection: ConnectionRecord
  let aliceConnection: ConnectionRecord

  const presentationPreview = PresentationPreview.fromRecord({
    name: 'John',
    age: '99',
  })

  beforeAll(async () => {
    testLogger.test('Initializing the agents')
    ;({ faberAgent, aliceAgent, credDefId, aliceConnection } = await setupProofsTest('Faber agent', 'Alice agent'))
  })

  afterAll(async () => {
    testLogger.test('Shutting down both agents')
    await faberAgent.shutdown()
    await faberAgent.wallet.delete()
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
  })

  // ====================
  // TEST V1 BEGIN
  // ====================

  test('Alice starts with V1 proof proposal to Faber', async () => {
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

    const presentationExchangeRecord = await aliceAgent.proofs.proposeProof(proposeOptions)

    expect(presentationExchangeRecord.connectionId).toEqual(proposeOptions.connectionId)
    expect(presentationExchangeRecord.protocolVersion).toEqual(ProofProtocolVersion.V1_0)
    expect(presentationExchangeRecord.state).toEqual(ProofState.ProposalSent)
    expect(presentationExchangeRecord.role).toEqual(ProofRole.Prover)
    expect(presentationExchangeRecord.threadId).not.toBeNull()

    testLogger.test('Faber waits for presentation from Alice')
    const faberPresentationRecord = await waitForProofRecord(faberAgent, {
      threadId: presentationExchangeRecord.threadId,
      state: ProofState.ProposalReceived,
    })
  })

  // ====================
  // TEST V1 END
  // ====================

  // ====================
  // TEST V2 BEGIN
  // ====================

  test('Alice starts with V2 proof proposal to Faber', async () => {
    testLogger.test('Alice sends (v2) proof proposal to Faber')

    const proposeOptions: ProposeProofOptions = {
      connectionId: aliceConnection.id,
      protocolVersion: ProofProtocolVersion.V2_0,
      proofFormats: {
        indy: {
          name: 'ProofRequest',
          nonce: '58d223e5-fc4d-4448-b74c-5eb11c6b558f',
          version: '0.1',
          proofPreview: presentationPreview,
        },
      },
      comment: 'V2 propose proof test',
    }

    const presentationExchangeRecord = await aliceAgent.proofs.proposeProof(proposeOptions)

    expect(presentationExchangeRecord.connectionId).toEqual(proposeOptions.connectionId)
    expect(presentationExchangeRecord.protocolVersion).toEqual(ProofProtocolVersion.V2_0)
    expect(presentationExchangeRecord.state).toEqual(ProofState.ProposalSent)
    expect(presentationExchangeRecord.role).toEqual(ProofRole.Prover)
    expect(presentationExchangeRecord.threadId).not.toBeNull()

    testLogger.test('Faber waits for presentation from Alice')
    const faberPresentationRecord = await waitForProofRecord(faberAgent, {
      threadId: presentationExchangeRecord.threadId,
      state: ProofState.ProposalReceived,
    })
  })
})
