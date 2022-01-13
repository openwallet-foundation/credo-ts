import type { Agent } from '../../../../agent/Agent'
import type { ConnectionRecord } from '../../../connections'
import type { ProposeProofOptions } from '../interface'
import type { CredDefId } from 'indy-sdk'

import { PredicateType } from '../..'
import { setupProofsTest } from '../../../../../tests/helpers'
import testLogger from '../../../../../tests/logger'
import { PresentationPreviewAttribute, PresentationPreviewPredicate } from '../../PresentationPreview'
import { ProofProtocolVersion } from '../../ProofProtocolVersion'

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

  // ====================
  // TEST V1 BEGIN
  // ====================

  test('Alice starts with V1 proof proposal to Faber', async () => {
    testLogger.test('Alice sends (v1) proof proposal to Faber')

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
      protocolVersion: ProofProtocolVersion.V1_0,
      proofFormats: {
        indy: {
          attributes,
          predicates,
        },
      },
      comment: 'V1 propose proof test',
    }

    const presentationExchangeRecord = await aliceAgent.proofs.proposeProof(proposeOptions)

    expect(presentationExchangeRecord.connectionId).toEqual(proposeOptions.connectionId)

    // let faberPresentationRecord = await waitForProofRecord(faberAgent, {
    //     threadId: presentationExchangeRecord
    // })
  })
})
