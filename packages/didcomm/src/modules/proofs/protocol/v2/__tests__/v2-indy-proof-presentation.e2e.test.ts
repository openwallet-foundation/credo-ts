import type { AnonCredsTestsAgent } from '../../../../../../../anoncreds/tests/legacyAnonCredsSetup'
import type { EventReplaySubject } from '../../../../../../../core/tests'

import {
  issueLegacyAnonCredsCredential,
  setupAnonCredsTests,
} from '../../../../../../../anoncreds/tests/legacyAnonCredsSetup'
import { testLogger, waitForProofExchangeRecordSubject } from '../../../../../../../core/tests'
import { DidCommProofState } from '../../../models/DidCommProofState'
import { DidCommProofExchangeRecord } from '../../../repository/DidCommProofExchangeRecord'

describe('V2 Proofs - Indy', () => {
  let faberAgent: AnonCredsTestsAgent
  let faberReplay: EventReplaySubject
  let aliceAgent: AnonCredsTestsAgent
  let aliceReplay: EventReplaySubject
  let faberConnectionId: string
  let aliceConnectionId: string
  let credentialDefinitionId: string

  beforeAll(async () => {
    testLogger.test('Initializing the agents')
    ;({
      issuerAgent: faberAgent,
      issuerReplay: faberReplay,
      holderAgent: aliceAgent,
      holderReplay: aliceReplay,
      issuerHolderConnectionId: faberConnectionId,
      holderIssuerConnectionId: aliceConnectionId,

      credentialDefinitionId,
    } = await setupAnonCredsTests({
      issuerName: 'Faber agent v2',
      holderName: 'Alice agent v2',
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
            value: 'Alice',
          },
          {
            name: 'age',
            value: '99',
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

    let aliceProofExchangeRecord = await aliceAgent.modules.proofs.proposeProof({
      connectionId: aliceConnectionId,
      protocolVersion: 'v2',
      proofFormats: {
        indy: {
          name: 'ProofRequest',
          version: '1.0',
          attributes: [
            {
              name: 'name',
              value: 'Alice',
              credentialDefinitionId,
            },
          ],
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
      comment: 'V2 propose proof test',
    })

    testLogger.test('Faber waits for presentation from Alice')
    let faberProofExchangeRecord = await waitForProofExchangeRecordSubject(faberReplay, {
      state: DidCommProofState.ProposalReceived,
    })

    const proposal = await faberAgent.modules.proofs.findProposalMessage(faberProofExchangeRecord.id)
    expect(proposal).toMatchObject({
      type: 'https://didcomm.org/present-proof/2.0/propose-presentation',
      formats: [
        {
          attachmentId: expect.any(String),
          format: 'hlindy/proof-req@v2.0',
        },
      ],
      proposalAttachments: [
        {
          id: expect.any(String),
          mimeType: 'application/json',
          data: {
            base64: expect.any(String),
          },
        },
      ],
      id: expect.any(String),
      comment: 'V2 propose proof test',
    })
    expect(faberProofExchangeRecord).toMatchObject({
      id: expect.anything(),
      threadId: faberProofExchangeRecord.threadId,
      state: DidCommProofState.ProposalReceived,
      protocolVersion: 'v2',
    })

    // Accept Proposal
    testLogger.test('Faber accepts presentation proposal from Alice')
    faberProofExchangeRecord = await faberAgent.modules.proofs.acceptProposal({
      proofExchangeRecordId: faberProofExchangeRecord.id,
    })

    testLogger.test('Alice waits for proof request from Faber')
    aliceProofExchangeRecord = await waitForProofExchangeRecordSubject(aliceReplay, {
      threadId: faberProofExchangeRecord.threadId,
      state: DidCommProofState.RequestReceived,
    })

    const request = await faberAgent.modules.proofs.findRequestMessage(faberProofExchangeRecord.id)
    expect(request).toMatchObject({
      type: 'https://didcomm.org/present-proof/2.0/request-presentation',
      formats: [
        {
          attachmentId: expect.any(String),
          format: 'hlindy/proof-req@v2.0',
        },
      ],
      requestAttachments: [
        {
          id: expect.any(String),
          mimeType: 'application/json',
          data: {
            base64: expect.any(String),
          },
        },
      ],
      id: expect.any(String),
      thread: {
        threadId: faberProofExchangeRecord.threadId,
      },
    })
    expect(aliceProofExchangeRecord).toMatchObject({
      id: expect.anything(),
      threadId: faberProofExchangeRecord.threadId,
      state: DidCommProofState.RequestReceived,
      protocolVersion: 'v2',
    })

    // Alice retrieves the requested credentials and accepts the presentation request
    testLogger.test('Alice accepts presentation request from Faber')

    const requestedCredentials = await aliceAgent.modules.proofs.selectCredentialsForRequest({
      proofExchangeRecordId: aliceProofExchangeRecord.id,
    })

    await aliceAgent.modules.proofs.acceptRequest({
      proofExchangeRecordId: aliceProofExchangeRecord.id,
      proofFormats: { indy: requestedCredentials.proofFormats.indy },
    })

    faberProofExchangeRecord = await waitForProofExchangeRecordSubject(faberReplay, {
      threadId: aliceProofExchangeRecord.threadId,
      state: DidCommProofState.PresentationReceived,
    })

    // Faber waits for the presentation from Alice
    testLogger.test('Faber waits for presentation from Alice')

    const presentation = await faberAgent.modules.proofs.findPresentationMessage(faberProofExchangeRecord.id)
    expect(presentation).toMatchObject({
      type: 'https://didcomm.org/present-proof/2.0/presentation',
      formats: [
        {
          attachmentId: expect.any(String),
          format: 'hlindy/proof@v2.0',
        },
      ],
      presentationAttachments: [
        {
          id: expect.any(String),
          mimeType: 'application/json',
          data: {
            base64: expect.any(String),
          },
        },
      ],
      id: expect.any(String),
      thread: {
        threadId: faberProofExchangeRecord.threadId,
      },
    })
    expect(faberProofExchangeRecord.id).not.toBeNull()
    expect(faberProofExchangeRecord).toMatchObject({
      threadId: faberProofExchangeRecord.threadId,
      state: DidCommProofState.PresentationReceived,
      protocolVersion: 'v2',
    })

    const aliceProofExchangeRecordPromise = waitForProofExchangeRecordSubject(aliceReplay, {
      threadId: aliceProofExchangeRecord.threadId,
      state: DidCommProofState.Done,
    })

    // Faber accepts the presentation provided by Alice
    testLogger.test('Faber accepts the presentation provided by Alice')
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
