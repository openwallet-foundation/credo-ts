import type { AnonCredsTestsAgent } from '../../../../../tests/legacyAnonCredsSetup'

import { testLogger, waitForProofExchangeRecord } from '../../../../../../core/tests'
import { DidCommProofState } from '../../../../../../didcomm/src'
import { setupAnonCredsTests } from '../../../../../tests/legacyAnonCredsSetup'

describe('Present Proof | DidCommProofV1Protocol', () => {
  let faberAgent: AnonCredsTestsAgent
  let aliceAgent: AnonCredsTestsAgent
  let aliceConnectionId: string
  let credentialDefinitionId: string

  beforeAll(async () => {
    testLogger.test('Initializing the agents')
    ;({
      issuerAgent: faberAgent,
      holderAgent: aliceAgent,
      credentialDefinitionId,
      holderIssuerConnectionId: aliceConnectionId,
    } = await setupAnonCredsTests({
      issuerName: 'Faber - V1 Indy Proof Request',
      holderName: 'Alice - V1 Indy Proof Request',
      attributeNames: ['name', 'age'],
    }))
  })

  afterAll(async () => {
    testLogger.test('Shutting down both agents')
    await faberAgent.shutdown()
    await aliceAgent.shutdown()
  })

  test('Alice Creates and sends Proof Proposal to Faber and Faber accepts the proposal', async () => {
    testLogger.test('Alice sends proof proposal to Faber')

    const faberProofExchangeRecordPromise = waitForProofExchangeRecord(faberAgent, {
      state: DidCommProofState.ProposalReceived,
    })

    let aliceProofExchangeRecord = await aliceAgent.didcomm.proofs.proposeProof({
      connectionId: aliceConnectionId,
      protocolVersion: 'v1',
      proofFormats: {
        indy: {
          name: 'Proof Request',
          version: '1.0',
          attributes: [
            {
              name: 'name',
              value: 'John',
              credentialDefinitionId,
              referent: '0',
            },
          ],
          predicates: [
            {
              name: 'age',
              predicate: '>=',
              threshold: 50,
              credentialDefinitionId,
            },
          ],
        },
      },
      comment: 'V1 propose proof test',
    })

    testLogger.test('Faber waits for presentation from Alice')
    let faberProofExchangeRecord = await faberProofExchangeRecordPromise

    const proposal = await faberAgent.didcomm.proofs.findProposalMessage(faberProofExchangeRecord.id)
    expect(proposal?.toJSON()).toMatchObject({
      '@type': 'https://didcomm.org/present-proof/1.0/propose-presentation',
      '@id': expect.any(String),
      comment: 'V1 propose proof test',
      presentation_proposal: {
        '@type': 'https://didcomm.org/present-proof/1.0/presentation-preview',
        attributes: [
          {
            name: 'name',
            cred_def_id: credentialDefinitionId,
            value: 'John',
            referent: '0',
          },
        ],
        predicates: [
          {
            name: 'age',
            cred_def_id: credentialDefinitionId,
            predicate: '>=',
            threshold: 50,
          },
        ],
      },
    })
    expect(faberProofExchangeRecord).toMatchObject({
      id: expect.anything(),
      threadId: faberProofExchangeRecord.threadId,
      state: DidCommProofState.ProposalReceived,
      protocolVersion: 'v1',
    })

    const aliceProofExchangeRecordPromise = waitForProofExchangeRecord(aliceAgent, {
      threadId: faberProofExchangeRecord.threadId,
      state: DidCommProofState.RequestReceived,
    })

    // Accept Proposal
    testLogger.test('Faber accepts presentation proposal from Alice')
    faberProofExchangeRecord = await faberAgent.didcomm.proofs.acceptProposal({
      proofExchangeRecordId: faberProofExchangeRecord.id,
    })

    testLogger.test('Alice waits for proof request from Faber')
    aliceProofExchangeRecord = await aliceProofExchangeRecordPromise

    const request = await faberAgent.didcomm.proofs.findRequestMessage(faberProofExchangeRecord.id)
    expect(request).toMatchObject({
      type: 'https://didcomm.org/present-proof/1.0/request-presentation',
      id: expect.any(String),
      requestAttachments: [
        {
          id: 'libindy-request-presentation-0',
          mimeType: 'application/json',
          data: {
            base64: expect.any(String),
          },
        },
      ],
      thread: {
        threadId: faberProofExchangeRecord.threadId,
      },
    })

    expect(aliceProofExchangeRecord).toMatchObject({
      id: expect.anything(),
      threadId: faberProofExchangeRecord.threadId,
      state: DidCommProofState.RequestReceived,
      protocolVersion: 'v1',
    })
  })
})
