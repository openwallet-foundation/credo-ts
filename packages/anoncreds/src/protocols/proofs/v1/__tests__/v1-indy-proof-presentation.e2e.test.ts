import type { EventReplaySubject } from '../../../../../../core/tests'
import type { AnonCredsTestsAgent } from '../../../../../tests/legacyAnonCredsSetup'

import { testLogger, waitForProofExchangeRecord } from '../../../../../../core/tests'
import { DidCommProofExchangeRecord, DidCommProofState } from '../../../../../../didcomm/src'
import { issueLegacyAnonCredsCredential, setupAnonCredsTests } from '../../../../../tests/legacyAnonCredsSetup'

describe('Present Proof', () => {
  let faberAgent: AnonCredsTestsAgent
  let faberReplay: EventReplaySubject
  let aliceAgent: AnonCredsTestsAgent
  let aliceReplay: EventReplaySubject
  let aliceConnectionId: string
  let faberConnectionId: string
  let credentialDefinitionId: string

  beforeAll(async () => {
    testLogger.test('Initializing the agents')
    ;({
      issuerAgent: faberAgent,
      issuerReplay: faberReplay,
      holderAgent: aliceAgent,
      holderReplay: aliceReplay,
      credentialDefinitionId,
      holderIssuerConnectionId: aliceConnectionId,
      issuerHolderConnectionId: faberConnectionId,
    } = await setupAnonCredsTests({
      issuerName: 'Faber - V1 Indy Proof',
      holderName: 'Alice - V1 Indy Proof',
      attributeNames: ['name', 'age'],
    }))

    await issueLegacyAnonCredsCredential({
      issuerAgent: faberAgent,
      issuerReplay: faberReplay,
      holderAgent: aliceAgent,
      holderReplay: aliceReplay,
      issuerHolderConnectionId: faberConnectionId,
      offer: {
        credentialDefinitionId,
        attributes: [
          {
            name: 'name',
            value: 'John',
          },
          {
            name: 'age',
            value: '55',
          },
        ],
      },
    })
  })

  afterAll(async () => {
    testLogger.test('Shutting down both agents')
    await faberAgent.shutdown()
    await aliceAgent.shutdown()
  })

  test('Alice Creates and sends Proof Proposal to Faber', async () => {
    testLogger.test('Alice sends proof proposal to Faber')

    let faberProofExchangeRecordPromise = waitForProofExchangeRecord(faberAgent, {
      state: DidCommProofState.ProposalReceived,
    })

    let aliceProofExchangeRecord = await aliceAgent.modules.proofs.proposeProof({
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

    let faberProofExchangeRecord = await faberProofExchangeRecordPromise

    const proposal = await faberAgent.modules.proofs.findProposalMessage(faberProofExchangeRecord.id)
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
      state: DidCommProofState.ProposalReceived,
      protocolVersion: 'v1',
    })

    // Accept Proposal
    let aliceProofExchangeRecordPromise = waitForProofExchangeRecord(aliceAgent, {
      threadId: faberProofExchangeRecord.threadId,
      state: DidCommProofState.RequestReceived,
    })

    testLogger.test('Faber accepts presentation proposal from Alice')
    faberProofExchangeRecord = await faberAgent.modules.proofs.acceptProposal({
      proofExchangeRecordId: faberProofExchangeRecord.id,
    })

    testLogger.test('Alice waits for proof request from Faber')
    aliceProofExchangeRecord = await aliceProofExchangeRecordPromise

    const request = await faberAgent.modules.proofs.findRequestMessage(faberProofExchangeRecord.id)
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

    const requestedCredentials = await aliceAgent.modules.proofs.selectCredentialsForRequest({
      proofExchangeRecordId: aliceProofExchangeRecord.id,
    })

    faberProofExchangeRecordPromise = waitForProofExchangeRecord(faberAgent, {
      threadId: aliceProofExchangeRecord.threadId,
      state: DidCommProofState.PresentationReceived,
    })

    await aliceAgent.modules.proofs.acceptRequest({
      proofExchangeRecordId: aliceProofExchangeRecord.id,
      proofFormats: { indy: requestedCredentials.proofFormats.indy },
    })

    // Faber waits for the presentation from Alice
    testLogger.test('Faber waits for presentation from Alice')
    faberProofExchangeRecord = await faberProofExchangeRecordPromise

    const presentation = await faberAgent.modules.proofs.findPresentationMessage(faberProofExchangeRecord.id)
    expect(presentation).toMatchObject({
      type: 'https://didcomm.org/present-proof/1.0/presentation',
      id: expect.any(String),
      presentationAttachments: [
        {
          id: 'libindy-presentation-0',
          mimeType: 'application/json',
          data: {
            base64: expect.any(String),
          },
        },
      ],
      thread: {
        threadId: expect.any(String),
      },
    })

    expect(faberProofExchangeRecord.id).not.toBeNull()
    expect(faberProofExchangeRecord).toMatchObject({
      threadId: faberProofExchangeRecord.threadId,
      state: DidCommProofState.PresentationReceived,
      protocolVersion: 'v1',
    })

    aliceProofExchangeRecordPromise = waitForProofExchangeRecord(aliceAgent, {
      threadId: aliceProofExchangeRecord.threadId,
      state: DidCommProofState.Done,
    })

    // Faber accepts the presentation provided by Alice
    await faberAgent.modules.proofs.acceptPresentation({ proofExchangeRecordId: faberProofExchangeRecord.id })

    // Alice waits until she received a presentation acknowledgement
    testLogger.test('Alice waits until she receives a presentation acknowledgement')
    aliceProofExchangeRecord = await aliceProofExchangeRecordPromise

    expect(faberProofExchangeRecord).toMatchObject({
      type: DidCommProofExchangeRecord.type,
      id: expect.any(String),
      createdAt: expect.any(Date),
      threadId: aliceProofExchangeRecord.threadId,
      connectionId: expect.any(String),
      isVerified: true,
      state: DidCommProofState.PresentationReceived,
    })

    expect(aliceProofExchangeRecord).toMatchObject({
      type: DidCommProofExchangeRecord.type,
      id: expect.any(String),
      createdAt: expect.any(Date),
      threadId: faberProofExchangeRecord.threadId,
      connectionId: expect.any(String),
      state: DidCommProofState.Done,
    })
  })
})
