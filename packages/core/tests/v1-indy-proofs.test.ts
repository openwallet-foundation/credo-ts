import type { Agent, ConnectionRecord, ProofRecord } from '../src'
import type {
  AcceptPresentationOptions,
  AcceptProposalOptions,
  ProposeProofOptions,
  RequestProofsOptions,
} from '../src/modules/proofs/models/ModuleOptions'
import type { PresentationPreview } from '../src/modules/proofs/protocol/v1/models/PresentationPreview'
import type { CredDefId } from 'indy-sdk'

import { AttributeFilter, PredicateType, ProofAttributeInfo, ProofPredicateInfo, ProofState } from '../src'
import { ProofProtocolVersion } from '../src/modules/proofs/models/ProofProtocolVersion'

import { setupProofsTest, waitForProofRecord } from './helpers'
import testLogger from './logger'

describe('Present Proof', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let credDefId: CredDefId
  let faberConnection: ConnectionRecord
  let aliceConnection: ConnectionRecord
  let faberProofRecord: ProofRecord
  let aliceProofRecord: ProofRecord
  let presentationPreview: PresentationPreview

  beforeAll(async () => {
    testLogger.test('Initializing the agents')
    ;({ faberAgent, aliceAgent, credDefId, faberConnection, aliceConnection, presentationPreview } =
      await setupProofsTest('Faber agent', 'Alice agent'))
  })

  afterAll(async () => {
    testLogger.test('Shutting down both agents')
    await faberAgent.shutdown()
    await faberAgent.wallet.delete()
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
  })

  test('Alice starts with proof proposal to Faber', async () => {
    // Alice sends a presentation proposal to Faber
    testLogger.test('Alice sends a presentation proposal to Faber')

    const proposeProofOptions: ProposeProofOptions = {
      connectionId: aliceConnection.id,
      protocolVersion: ProofProtocolVersion.V1_0,
      proofFormats: {
        indy: {
          nonce: '58d223e5-fc4d-4448-b74c-5eb11c6b558f',
          proofPreview: presentationPreview,
          name: 'abc',
          version: '1.0',
        },
      },
    }
    aliceProofRecord = await aliceAgent.proofs.proposeProof(proposeProofOptions)

    // Faber waits for a presentation proposal from Alice
    testLogger.test('Faber waits for a presentation proposal from Alice')
    faberProofRecord = await waitForProofRecord(faberAgent, {
      threadId: aliceProofRecord.threadId,
      state: ProofState.ProposalReceived,
    })

    expect(faberProofRecord.id).not.toBeNull()
    expect(faberProofRecord).toMatchObject({
      threadId: faberProofRecord.threadId,
      state: ProofState.ProposalReceived,
      protocolVersion: ProofProtocolVersion.V1_0,
    })

    const acceptProposalOptions: AcceptProposalOptions = {
      proofFormats: {
        indy: {
          name: 'proof-request',
          version: '1.0',
          nonce: '58d223e5-fc4d-4448-b74c-5eb11c6b558f',
          attributes: presentationPreview.attributes,
          predicates: presentationPreview.predicates,
        },
      },
      proofRecordId: faberProofRecord.id,
      protocolVersion: ProofProtocolVersion.V1_0,
    }

    // Faber accepts the presentation proposal from Alice
    testLogger.test('Faber accepts presentation proposal from Alice')
    faberProofRecord = await faberAgent.proofs.acceptProposal(acceptProposalOptions)

    // Alice waits for presentation request from Faber
    testLogger.test('Alice waits for presentation request from Faber')
    aliceProofRecord = await waitForProofRecord(aliceAgent, {
      threadId: aliceProofRecord.threadId,
      state: ProofState.RequestReceived,
    })

    // Alice retrieves the requested credentials and accepts the presentation request
    testLogger.test('Alice accepts presentation request from Faber')
    const retrievedCredentials = await aliceAgent.proofs.getRequestedCredentialsForProofRequest(
      aliceProofRecord.id,
      ProofProtocolVersion.V1_0,
      {
        filterByPresentationPreview: true,
      }
    )

    const requestedCredentials = await aliceAgent.proofs.autoSelectCredentialsForProofRequest({
      formats: {
        indy: retrievedCredentials.indy,
      },
      version: ProofProtocolVersion.V1_0,
    })

    const acceptPresentationOptions: AcceptPresentationOptions = {
      protocolVersion: ProofProtocolVersion.V1_0,
      proofRecordId: aliceProofRecord.id,
      proofFormats: { indy: requestedCredentials.indy },
    }
    await aliceAgent.proofs.acceptRequest(acceptPresentationOptions)

    // Faber waits for the presentation from Alice
    testLogger.test('Faber waits for presentation from Alice')
    faberProofRecord = await waitForProofRecord(faberAgent, {
      threadId: aliceProofRecord.threadId,
      state: ProofState.PresentationReceived,
    })

    expect(faberProofRecord.id).not.toBeNull()
    expect(faberProofRecord).toMatchObject({
      threadId: faberProofRecord.threadId,
      state: ProofState.PresentationReceived,
      protocolVersion: ProofProtocolVersion.V1_0,
    })

    // Faber accepts the presentation provided by Alice
    testLogger.test('Faber accepts the presentation provided by Alice')
    await faberAgent.proofs.acceptPresentation(faberProofRecord.id, ProofProtocolVersion.V1_0)

    // Alice waits until she received a presentation acknowledgement
    testLogger.test('Alice waits until she receives a presentation acknowledgement')
    aliceProofRecord = await waitForProofRecord(aliceAgent, {
      threadId: aliceProofRecord.threadId,
      state: ProofState.Done,
    })

    expect(faberProofRecord).toMatchObject({
      // type: ProofRecord.name,
      id: expect.any(String),
      createdAt: expect.any(Date),
      threadId: aliceProofRecord.threadId,
      connectionId: expect.any(String),
      isVerified: true,
      state: ProofState.PresentationReceived,
    })

    expect(aliceProofRecord).toMatchObject({
      // type: ProofRecord.name,
      id: expect.any(String),
      createdAt: expect.any(Date),
      threadId: faberProofRecord.threadId,
      connectionId: expect.any(String),
      state: ProofState.Done,
    })
  })

  test('Faber starts with proof request to Alice', async () => {
    const attributes = {
      name: new ProofAttributeInfo({
        name: 'name',
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: credDefId,
          }),
        ],
      }),
      image_0: new ProofAttributeInfo({
        name: 'image_0',
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: credDefId,
          }),
        ],
      }),
    }

    // Sample predicates
    const predicates = {
      age: new ProofPredicateInfo({
        name: 'age',
        predicateType: PredicateType.GreaterThanOrEqualTo,
        predicateValue: 50,
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: credDefId,
          }),
        ],
      }),
    }

    const requestProofsOptions: RequestProofsOptions = {
      protocolVersion: ProofProtocolVersion.V1_0,
      connectionId: faberConnection.id,
      proofRequestOptions: {
        indy: {
          name: 'proof-request',
          version: '1.0',
          nonce: '1298236324864',
          requestedAttributes: attributes,
          requestedPredicates: predicates,
        },
      },
    }

    // Faber sends a presentation request to Alice
    testLogger.test('Faber sends a presentation request to Alice')
    faberProofRecord = await faberAgent.proofs.requestProof(requestProofsOptions)

    // Alice waits for presentation request from Faber
    testLogger.test('Alice waits for presentation request from Faber')
    aliceProofRecord = await waitForProofRecord(aliceAgent, {
      threadId: faberProofRecord.threadId,
      state: ProofState.RequestReceived,
    })

    expect(aliceProofRecord.id).not.toBeNull()
    expect(aliceProofRecord).toMatchObject({
      threadId: aliceProofRecord.threadId,
      state: ProofState.RequestReceived,
      protocolVersion: ProofProtocolVersion.V1_0,
    })

    // Alice retrieves the requested credentials and accepts the presentation request
    testLogger.test('Alice accepts presentation request from Faber')
    const retrievedCredentials = await aliceAgent.proofs.getRequestedCredentialsForProofRequest(
      aliceProofRecord.id,
      ProofProtocolVersion.V1_0,
      {
        filterByPresentationPreview: true,
      }
    )
    const requestedCredentials = await aliceAgent.proofs.autoSelectCredentialsForProofRequest({
      formats: {
        indy: retrievedCredentials.indy,
      },
      version: ProofProtocolVersion.V1_0,
    })

    const acceptPresentationOptions: AcceptPresentationOptions = {
      protocolVersion: ProofProtocolVersion.V1_0,
      proofRecordId: aliceProofRecord.id,
      proofFormats: { indy: requestedCredentials.indy },
    }

    await aliceAgent.proofs.acceptRequest(acceptPresentationOptions)

    // Faber waits until it receives a presentation from Alice
    testLogger.test('Faber waits for presentation from Alice')
    faberProofRecord = await waitForProofRecord(faberAgent, {
      threadId: aliceProofRecord.threadId,
      state: ProofState.PresentationReceived,
    })

    expect(faberProofRecord.id).not.toBeNull()
    expect(faberProofRecord).toMatchObject({
      threadId: faberProofRecord.threadId,
      state: ProofState.PresentationReceived,
      protocolVersion: ProofProtocolVersion.V1_0,
    })

    // Faber accepts the presentation
    testLogger.test('Faber accept the presentation from Alice')
    await faberAgent.proofs.acceptPresentation(faberProofRecord.id, ProofProtocolVersion.V1_0)

    // Alice waits until she receives a presentation acknowledgement
    testLogger.test('Alice waits for acceptance by Faber')
    aliceProofRecord = await waitForProofRecord(aliceAgent, {
      threadId: aliceProofRecord.threadId,
      state: ProofState.Done,
    })

    expect(faberProofRecord).toMatchObject({
      // type: ProofRecord.name,
      id: expect.any(String),
      createdAt: expect.any(Date),
      threadId: aliceProofRecord.threadId,
      connectionId: expect.any(String),
      isVerified: true,
      state: ProofState.PresentationReceived,
    })

    expect(aliceProofRecord).toMatchObject({
      // type: ProofRecord.name,
      id: expect.any(String),
      createdAt: expect.any(Date),
      threadId: faberProofRecord.threadId,
      connectionId: expect.any(String),
      state: ProofState.Done,
    })
  })
})
