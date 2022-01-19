import type { Agent } from '../../../../agent/Agent'
import type { ConnectionRecord } from '../../../connections'
import type { AcceptProposalOptions, ProposeProofOptions } from '../interface'
import type { CredDefId } from 'indy-sdk'

import { ProofState } from '../..'
import { setupProofsTest, waitForProofRecord } from '../../../../../tests/helpers'
import testLogger from '../../../../../tests/logger'
import { JsonTransformer } from '../../../../utils/JsonTransformer'
import { PresentationPreview } from '../../PresentationPreview'
import { ProofProtocolVersion } from '../../ProofProtocolVersion'
import { ProofRole } from '../ProofRole'

describe('Present Proof', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let credDefId: CredDefId
  // let faberConnection: ConnectionRecord
  let aliceConnection: ConnectionRecord
  let presentationPreview: PresentationPreview
  beforeAll(async () => {
    testLogger.test('Initializing the agents')
    ;({ faberAgent, aliceAgent, credDefId, aliceConnection } = await setupProofsTest('Faber agent', 'Alice agent'))
    presentationPreview = PresentationPreview.fromRecord({
      name: 'John',
      age: '99',
      // cred_def_id: credDefId,
    })
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

    console.log('presentationPreview:::', presentationPreview)

    const alicePresentationExchangeRecord = await aliceAgent.proofs.proposeProof(proposeOptions)

    console.log('alicePresentationExchangeRecord::', alicePresentationExchangeRecord)

    expect(alicePresentationExchangeRecord.connectionId).toEqual(proposeOptions.connectionId)
    expect(alicePresentationExchangeRecord.protocolVersion).toEqual(ProofProtocolVersion.V1_0)
    expect(alicePresentationExchangeRecord.state).toEqual(ProofState.ProposalSent)
    expect(alicePresentationExchangeRecord.role).toEqual(ProofRole.Prover)
    expect(alicePresentationExchangeRecord.threadId).not.toBeNull()

    testLogger.test('Faber waits for presentation from Alice')
    let faberPresentationRecord = await waitForProofRecord(faberAgent, {
      threadId: alicePresentationExchangeRecord.threadId,
      state: ProofState.ProposalReceived,
    })

    expect(JsonTransformer.toJSON(alicePresentationExchangeRecord)).toMatchObject({
      createdAt: expect.any(Date),
      id: expect.any(String),
      proposalMessage: {
        '@type': 'https://didcomm.org/present-proof/1.0/propose-presentation',
        '@id': expect.any(String),
        presentation_proposal: {
          '@type': 'https://didcomm.org/present-proof/1.0/presentation-preview',
          attributes: [
            {
              cred_def_id: undefined,
              name: 'name',
              'mime-type': 'text/plain',
              value: 'John',
              referent: undefined,
            },
            {
              cred_def_id: undefined,
              name: 'age',
              'mime-type': 'text/plain',
              value: '99',
              referent: undefined,
            },
          ],
          predicates: [
            // {
            //   cred_def_id: credDefId,
            //   name: 'age',
            //   predicate: '>=',
            //   threshold: 50,
            // },
          ],
        },
      },
    })

    // Accept Proposal
    const acceptProposalOptions: AcceptProposalOptions = {
      proofRecordId: faberPresentationRecord.id,
      protocolVersion: ProofProtocolVersion.V1_0,
    }
    testLogger.test('Faber accepts presentation proposal from Alice')
    const proofRecord = await faberAgent.proofs.acceptProposal(acceptProposalOptions)
    console.log('proofRecord:', proofRecord)

    testLogger.test('Alice waits for proof request from Faber')
    faberPresentationRecord = await waitForProofRecord(aliceAgent, {
      threadId: alicePresentationExchangeRecord.threadId,
      state: ProofState.RequestReceived,
    })
    console.log('faberPresentationRecord', faberPresentationRecord)
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

    const aliceV2PresentationExchangeRecord = await aliceAgent.proofs.proposeProof(proposeOptions)

    expect(aliceV2PresentationExchangeRecord.connectionId).toEqual(proposeOptions.connectionId)
    expect(aliceV2PresentationExchangeRecord.protocolVersion).toEqual(ProofProtocolVersion.V2_0)
    expect(aliceV2PresentationExchangeRecord.state).toEqual(ProofState.ProposalSent)
    expect(aliceV2PresentationExchangeRecord.role).toEqual(ProofRole.Prover)
    expect(aliceV2PresentationExchangeRecord.threadId).not.toBeNull()

    testLogger.test('Faber waits for presentation from Alice')
    let faberPresentationRecord = await waitForProofRecord(faberAgent, {
      threadId: aliceV2PresentationExchangeRecord.threadId,
      state: ProofState.ProposalReceived,
    })

    expect(JsonTransformer.toJSON(aliceV2PresentationExchangeRecord)).toMatchObject({
      createdAt: expect.any(Date),
      id: expect.any(String),
      proposalMessage: {
        '@type': 'https://didcomm.org/present-proof/2.0/propose-presentation',
        '@id': expect.any(String),
        presentation_proposal: {
          '@type': 'https://didcomm.org/present-proof/1.0/presentation-preview',
          attributes: [
            {
              cred_def_id: undefined,
              name: 'name',
              'mime-type': 'text/plain',
              value: 'John',
              referent: undefined,
            },
            {
              cred_def_id: undefined,
              name: 'age',
              'mime-type': 'text/plain',
              value: '99',
              referent: undefined,
            },
          ],
          predicates: [
            // {
            //   cred_def_id: credDefId,
            //   name: 'age',
            //   predicate: '>=',
            //   threshold: 50,
            // },
          ],
        },
      },
    })

    // TODO Accept Proposal
    // Accept Proposal
    // const acceptProposalOptions: AcceptProposalOptions = {
    //   proofRecordId: faberPresentationRecord.id,
    //   protocolVersion: ProofProtocolVersion.V2_0,
    // }
    // testLogger.test('Faber accepts presentation proposal from Alice')
    // const proofRecord = await faberAgent.proofs.acceptProposal(acceptProposalOptions)
    // console.log('v2 proofRecord:', proofRecord)

    // testLogger.test('Alice waits for proof request from Faber')
    // faberPresentationRecord = await waitForProofRecord(aliceAgent, {
    //   threadId: aliceV2PresentationExchangeRecord.threadId,
    //   state: ProofState.RequestReceived,
    // })
    // console.log('v2 faberPresentationRecord', faberPresentationRecord)
  })
})
