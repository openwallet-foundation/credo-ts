import type { Agent } from '../../../../../agent/Agent'
import type { ConnectionRecord } from '../../../../connections/repository/ConnectionRecord'
import type { AcceptProofProposalOptions } from '../../../ProofsApiOptions'
import type { ProofExchangeRecord } from '../../../repository/ProofExchangeRecord'
import type { PresentationPreview } from '../../v1/models/V1PresentationPreview'

import { setupProofsTest, waitForProofExchangeRecord } from '../../../../../../tests/helpers'
import testLogger from '../../../../../../tests/logger'
import { DidCommMessageRepository } from '../../../../../storage'
import { ProofState } from '../../../models/ProofState'

describe('Present Proof', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let aliceConnection: ConnectionRecord
  let presentationPreview: PresentationPreview
  let faberProofExchangeRecord: ProofExchangeRecord
  let aliceProofExchangeRecord: ProofExchangeRecord

  beforeAll(async () => {
    testLogger.test('Initializing the agents')
    ;({ faberAgent, aliceAgent, aliceConnection, presentationPreview } = await setupProofsTest(
      'Faber agent v2 Indy present proof format data',
      'Alice agent v2 Indy present proof format data'
    ))
  })

  afterAll(async () => {
    testLogger.test('Shutting down both agents')
    await faberAgent.shutdown()
    await faberAgent.wallet.delete()
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
  })

  test(`Test Format Data`, async () => {
    testLogger.test('Alice sends proof proposal to Faber')

    let faberPresentationRecordPromise = waitForProofExchangeRecord(faberAgent, {
      state: ProofState.ProposalReceived,
    })

    aliceProofExchangeRecord = await aliceAgent.proofs.proposeProof({
      connectionId: aliceConnection.id,
      protocolVersion: 'v2',
      proofFormats: {
        indy: {
          name: 'ProofRequest',
          nonce: '947121108704767252195126',
          version: '1.0',
          attributes: presentationPreview.attributes,
          predicates: presentationPreview.predicates,
        },
      },
      comment: 'V2 propose proof test',
    })

    testLogger.test('Faber waits for presentation from Alice')
    faberProofExchangeRecord = await faberPresentationRecordPromise

    faberAgent.injectionContainer.resolve<DidCommMessageRepository>(DidCommMessageRepository)

    // Accept Proposal
    const acceptProposalOptions: AcceptProofProposalOptions = {
      proofRecordId: faberProofExchangeRecord.id,
    }

    const alicePresentationRecordPromise = waitForProofExchangeRecord(aliceAgent, {
      threadId: faberProofExchangeRecord.threadId,
      state: ProofState.RequestReceived,
    })

    testLogger.test('Faber accepts presentation proposal from Alice')
    faberProofExchangeRecord = await faberAgent.proofs.acceptProposal(acceptProposalOptions)

    testLogger.test('Alice waits for proof request from Faber')
    aliceProofExchangeRecord = await alicePresentationRecordPromise

    faberAgent.injectionContainer.resolve<DidCommMessageRepository>(DidCommMessageRepository)

    // Alice retrieves the requested credentials and accepts the presentation request

    const requestedCredentials = await aliceAgent.proofs.autoSelectCredentialsForProofRequest({
      proofRecordId: aliceProofExchangeRecord.id,
      config: {
        filterByPresentationPreview: true,
      },
    })

    faberPresentationRecordPromise = waitForProofExchangeRecord(faberAgent, {
      threadId: aliceProofExchangeRecord.threadId,
      state: ProofState.PresentationReceived,
    })

    await aliceAgent.proofs.acceptRequest({
      proofRecordId: aliceProofExchangeRecord.id,
      proofFormats: { indy: requestedCredentials.proofFormats.indy },
    })

    // Faber waits for the presentation from Alice
    testLogger.test('Faber waits for presentation from Alice')
    faberProofExchangeRecord = await faberPresentationRecordPromise

    const aliceProofExchangeRecordPromise = waitForProofExchangeRecord(aliceAgent, {
      threadId: aliceProofExchangeRecord.threadId,
      state: ProofState.Done,
    })

    // Faber accepts the presentation provided by Alice
    testLogger.test('Faber accepts the presentation provided by Alice')
    await faberAgent.proofs.acceptPresentation(faberProofExchangeRecord.id)

    // Alice waits until she received a presentation acknowledgement
    testLogger.test('Alice waits until she receives a presentation acknowledgement')
    await aliceProofExchangeRecordPromise

    const formatData = await faberAgent.proofs.getFormatData(faberProofExchangeRecord.id)

    expect(formatData).toMatchObject({
      proposal: {
        indy: {
          name: 'ProofRequest',
          version: '1.0',
          nonce: expect.any(String),
          requested_attributes: {
            '0': {
              name: 'name',
              restrictions: expect.any(Object),
            },
          },
          requested_predicates: expect.any(Object),
        },
      },
      request: {
        indy: {
          name: 'ProofRequest',
          version: '1.0',
          nonce: expect.any(String),
          requested_attributes: expect.any(Object),
          requested_predicates: expect.any(Object),
        },
      },
      presentation: {
        indy: {
          proof: expect.any(Object),
          requested_proof: expect.any(Object),
          identifiers: [
            {
              cred_def_id: expect.any(String),
              rev_reg_id: null,
              schema_id: expect.any(String),
              timestamp: null,
            },
          ],
        },
      },
    })
  })
})
