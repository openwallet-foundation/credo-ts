import type { AnonCredsTestsAgent } from '../../../../../tests/legacyAnonCredsSetup'

import { testLogger, waitForProofExchangeRecord } from '../../../../../../core/tests'
import { ProofState } from '../../../../../../didcomm/src'
import { setupAnonCredsTests } from '../../../../../tests/legacyAnonCredsSetup'

describe('Present Proof', () => {
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

  test('Alice Creates and sends Proof Proposal to Faber', async () => {
    testLogger.test('Alice sends proof proposal to Faber')

    const faberProofExchangeRecordPromise = waitForProofExchangeRecord(faberAgent, {
      state: ProofState.ProposalReceived,
    })

    await aliceAgent.didcomm.proofs.proposeProof({
      connectionId: aliceConnectionId,
      protocolVersion: 'v1',
      proofFormats: {
        indy: {
          name: 'ProofRequest',
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
    const faberProofExchangeRecord = await faberProofExchangeRecordPromise

    const proposal = await faberAgent.didcomm.proofs.findProposalMessage(faberProofExchangeRecord.id)
    expect(proposal).toMatchObject({
      type: 'https://didcomm.org/present-proof/1.0/propose-presentation',
      id: expect.any(String),
      comment: 'V1 propose proof test',
      presentationProposal: {
        type: 'https://didcomm.org/present-proof/1.0/presentation-preview',
        attributes: [
          {
            name: 'name',
            credentialDefinitionId,
            value: 'John',
            referent: '0',
          },
        ],
        predicates: [
          {
            name: 'age',
            credentialDefinitionId,
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
