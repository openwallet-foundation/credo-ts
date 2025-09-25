import type { EventReplaySubject } from '../../../../../../core/tests'
import type { AnonCredsTestsAgent } from '../../../../../tests/legacyAnonCredsSetup'

import { testLogger, waitForProofExchangeRecord } from '../../../../../../core/tests'
import { ProofExchangeRecord, ProofState } from '../../../../../../didcomm/src'
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
      state: ProofState.ProposalReceived,
    })

    let aliceProofExchangeRecord = await aliceAgent.didcomm.proofs.proposeProof({
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

    // Accept Proposal
    let aliceProofExchangeRecordPromise = waitForProofExchangeRecord(aliceAgent, {
      threadId: faberProofExchangeRecord.threadId,
      state: ProofState.RequestReceived,
    })

    testLogger.test('Faber accepts presentation proposal from Alice')
    faberProofExchangeRecord = await faberAgent.didcomm.proofs.acceptProposal({
      proofRecordId: faberProofExchangeRecord.id,
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
      state: ProofState.RequestReceived,
      protocolVersion: 'v1',
    })

    const requestedCredentials = await aliceAgent.didcomm.proofs.selectCredentialsForRequest({
      proofRecordId: aliceProofExchangeRecord.id,
    })

    faberProofExchangeRecordPromise = waitForProofExchangeRecord(faberAgent, {
      threadId: aliceProofExchangeRecord.threadId,
      state: ProofState.PresentationReceived,
    })

    await aliceAgent.didcomm.proofs.acceptRequest({
      proofRecordId: aliceProofExchangeRecord.id,
      proofFormats: { indy: requestedCredentials.proofFormats.indy },
    })

    // Faber waits for the presentation from Alice
    testLogger.test('Faber waits for presentation from Alice')
    faberProofExchangeRecord = await faberProofExchangeRecordPromise

    const presentation = await faberAgent.didcomm.proofs.findPresentationMessage(faberProofExchangeRecord.id)
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
      state: ProofState.PresentationReceived,
      protocolVersion: 'v1',
    })

    aliceProofExchangeRecordPromise = waitForProofExchangeRecord(aliceAgent, {
      threadId: aliceProofExchangeRecord.threadId,
      state: ProofState.Done,
    })

    // Faber accepts the presentation provided by Alice
    await faberAgent.didcomm.proofs.acceptPresentation({ proofRecordId: faberProofExchangeRecord.id })

    // Alice waits until she received a presentation acknowledgement
    testLogger.test('Alice waits until she receives a presentation acknowledgement')
    aliceProofExchangeRecord = await aliceProofExchangeRecordPromise

    expect(faberProofExchangeRecord).toMatchObject({
      type: ProofExchangeRecord.type,
      id: expect.any(String),
      createdAt: expect.any(Date),
      threadId: aliceProofExchangeRecord.threadId,
      connectionId: expect.any(String),
      isVerified: true,
      state: ProofState.PresentationReceived,
    })

    expect(aliceProofExchangeRecord).toMatchObject({
      type: ProofExchangeRecord.type,
      id: expect.any(String),
      createdAt: expect.any(Date),
      threadId: faberProofExchangeRecord.threadId,
      connectionId: expect.any(String),
      state: ProofState.Done,
    })
  })
})
