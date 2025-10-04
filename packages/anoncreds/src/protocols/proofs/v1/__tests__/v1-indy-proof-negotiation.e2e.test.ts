import type { AcceptProofProposalOptions } from '../../../../../../didcomm/src'
import type { AnonCredsTestsAgent } from '../../../../../tests/legacyAnonCredsSetup'
import type { DidCommRequestPresentationV1Message } from '../messages'

import { testLogger, waitForProofExchangeRecord } from '../../../../../../core/tests'
import { DidCommProofState } from '../../../../../../didcomm/src'
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
      issuerName: 'Faber - V1 Indy Proof Negotiation',
      holderName: 'Alice - V1 Indy Proof Negotiation',
      attributeNames: ['name', 'age'],
    }))
  })

  afterAll(async () => {
    testLogger.test('Shutting down both agents')
    await faberAgent.shutdown()
    await aliceAgent.shutdown()
  })

  test('Proof negotiation between Alice and Faber', async () => {
    testLogger.test('Alice sends proof proposal to Faber')

    let faberProofExchangeRecordPromise = waitForProofExchangeRecord(faberAgent, {
      state: DidCommProofState.ProposalReceived,
    })

    let aliceProofExchangeRecord = await aliceAgent.didcomm.proofs.proposeProof({
      connectionId: aliceConnectionId,
      protocolVersion: 'v1',
      proofFormats: {
        indy: {
          name: 'proof-request',
          version: '1.0',
          attributes: [],
          predicates: [
            {
              credentialDefinitionId,
              name: 'age',
              predicate: '>=',
              threshold: 18,
            },
          ],
        },
      },
      comment: 'V1 propose proof test 1',
    })

    testLogger.test('Faber waits for presentation from Alice')
    let faberProofExchangeRecord = await faberProofExchangeRecordPromise

    let proposal = await faberAgent.didcomm.proofs.findProposalMessage(faberProofExchangeRecord.id)
    expect(proposal).toMatchObject({
      type: 'https://didcomm.org/present-proof/1.0/propose-presentation',
      id: expect.any(String),
      comment: 'V1 propose proof test 1',
      presentationProposal: {
        type: 'https://didcomm.org/present-proof/1.0/presentation-preview',
        attributes: [],
        predicates: [
          {
            name: 'age',
            credentialDefinitionId,
            predicate: '>=',
            threshold: 18,
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

    let aliceProofExchangeRecordPromise = waitForProofExchangeRecord(aliceAgent, {
      threadId: faberProofExchangeRecord.threadId,
      state: DidCommProofState.RequestReceived,
    })

    testLogger.test('Faber sends new proof request to Alice')
    faberProofExchangeRecord = await faberAgent.didcomm.proofs.negotiateProposal({
      proofExchangeRecordId: faberProofExchangeRecord.id,
      proofFormats: {
        indy: {
          name: 'proof-request',
          version: '1.0',
          requested_attributes: {
            something: {
              name: 'name',
              restrictions: [
                {
                  cred_def_id: credentialDefinitionId,
                },
              ],
            },
          },
          requested_predicates: {
            somethingElse: {
              name: 'age',
              p_type: '>=',
              p_value: 50,
              restrictions: [
                {
                  cred_def_id: credentialDefinitionId,
                },
              ],
            },
          },
        },
      },
    })

    testLogger.test('Alice waits for proof request from Faber')
    aliceProofExchangeRecord = await aliceProofExchangeRecordPromise

    let request = await faberAgent.didcomm.proofs.findRequestMessage(faberProofExchangeRecord.id)
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

    testLogger.test('Alice sends proof proposal to Faber')

    faberProofExchangeRecordPromise = waitForProofExchangeRecord(faberAgent, {
      state: DidCommProofState.ProposalReceived,
    })

    aliceProofExchangeRecord = await aliceAgent.didcomm.proofs.negotiateRequest({
      proofExchangeRecordId: aliceProofExchangeRecord.id,
      proofFormats: {
        indy: {
          name: 'proof-request',
          version: '1.0',
          attributes: [],
          predicates: [
            {
              credentialDefinitionId,
              name: 'age',
              predicate: '>=',
              threshold: 18,
            },
          ],
        },
      },
      comment: 'V1 propose proof test 2',
    })

    testLogger.test('Faber waits for presentation from Alice')
    faberProofExchangeRecord = await faberProofExchangeRecordPromise

    proposal = await faberAgent.didcomm.proofs.findProposalMessage(faberProofExchangeRecord.id)
    expect(proposal).toMatchObject({
      type: 'https://didcomm.org/present-proof/1.0/propose-presentation',
      id: expect.any(String),
      comment: 'V1 propose proof test 2',
      presentationProposal: {
        type: 'https://didcomm.org/present-proof/1.0/presentation-preview',
        attributes: [],
        predicates: [
          {
            name: 'age',
            credentialDefinitionId,
            predicate: '>=',
            threshold: 18,
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

    // Accept Proposal
    const acceptProposalOptions: AcceptProofProposalOptions = {
      proofExchangeRecordId: faberProofExchangeRecord.id,
    }

    aliceProofExchangeRecordPromise = waitForProofExchangeRecord(aliceAgent, {
      threadId: faberProofExchangeRecord.threadId,
      state: DidCommProofState.RequestReceived,
    })

    testLogger.test('Faber accepts presentation proposal from Alice')
    faberProofExchangeRecord = await faberAgent.didcomm.proofs.acceptProposal(acceptProposalOptions)

    testLogger.test('Alice waits for proof request from Faber')
    aliceProofExchangeRecord = await aliceProofExchangeRecordPromise

    request = await faberAgent.didcomm.proofs.findRequestMessage(faberProofExchangeRecord.id)
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

    const proposalMessage = await aliceAgent.didcomm.proofs.findProposalMessage(aliceProofExchangeRecord.id)
    expect(proposalMessage).toMatchObject({
      type: 'https://didcomm.org/present-proof/1.0/propose-presentation',
      id: expect.any(String),
      comment: 'V1 propose proof test 2',
      presentationProposal: {
        type: 'https://didcomm.org/present-proof/1.0/presentation-preview',
        attributes: [],
        predicates: [
          {
            name: 'age',
            credentialDefinitionId,
            predicate: '>=',
            threshold: 18,
          },
        ],
      },
    })

    const proofRequestMessage = (await aliceAgent.didcomm.proofs.findRequestMessage(
      aliceProofExchangeRecord.id
    )) as DidCommRequestPresentationV1Message

    const predicateKey = Object.keys(proofRequestMessage.indyProofRequest?.requested_predicates ?? {})[0]
    expect(proofRequestMessage.indyProofRequest).toMatchObject({
      name: 'Proof Request',
      version: '1.0',
      requested_attributes: {},
      requested_predicates: {
        [predicateKey]: {
          p_type: '>=',
          p_value: 18,
          restrictions: [
            {
              cred_def_id: credentialDefinitionId,
            },
          ],
        },
      },
    })
  })
})
