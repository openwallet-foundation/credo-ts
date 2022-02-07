import type { Agent } from '../../../../../agent/Agent'
import type { ConnectionRecord } from '../../../../connections/repository/ConnectionRecord'
import type { ProposeProofOptions } from '../../../models/ModuleOptions'
import type { CredDefId } from 'indy-sdk'

import { setupProofsTest, waitForProofRecord } from '../../../../../../tests/helpers'
import testLogger from '../../../../../../tests/logger'
import { ProofProtocolVersion } from '../../../models/ProofProtocolVersion'
import { ProofRole } from '../../../models/ProofRole'
import { ProofState } from '../../../models/ProofState'
import { PredicateType } from '../../v1/models/PredicateType'
import { PresentationPreviewAttribute, PresentationPreviewPredicate } from '../../v1/models/PresentationPreview'

describe('Present Proof', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let credDefId: CredDefId
  // let faberConnection: ConnectionRecord
  let aliceConnection: ConnectionRecord
  // let presentationPreview: PresentationPreview

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

  test('Alice starts with V2 proof proposal to Faber', async () => {
    testLogger.test('Alice sends (v2) proof proposal to Faber')

    const attributes = [
      new PresentationPreviewAttribute({
        name: 'name',
        credentialDefinitionId: credDefId,
        value: 'John',
      }),
    ]

    const predicates = [
      new PresentationPreviewPredicate({
        name: 'age',
        predicate: PredicateType.GreaterThanOrEqualTo,
        threshold: 50,
        credentialDefinitionId: credDefId,
      }),
    ]

    const proposeOptions: ProposeProofOptions = {
      connectionId: aliceConnection.id,
      protocolVersion: ProofProtocolVersion.V2_0,
      proofFormats: {
        indy: {
          name: 'ProofRequest',
          nonce: '58d223e5-fc4d-4448-b74c-5eb11c6b558f',
          version: '0.1',
          attributes,
          predicates,
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
