import { Subject } from 'rxjs'
import type { SubjectMessage } from '../../../../../../../tests/transport/SubjectInboundTransport'
import { SubjectInboundTransport } from '../../../../../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../../../../../tests/transport/SubjectOutboundTransport'
import { Agent } from '../../../../../../core/src'
import { uuid } from '../../../../../../core/src/utils/uuid'
import {
  getAgentOptions,
  makeConnection,
  setupEventReplaySubjects,
  testLogger,
  waitForProofExchangeRecordSubject,
} from '../../../../../../core/tests'
import {
  DidCommAttachment,
  DidCommAttachmentData,
  DidCommAutoAcceptProof,
  DidCommCredentialEventTypes,
  DidCommHandshakeProtocol,
  DidCommLinkedAttachment,
  DidCommMediatorPickupStrategy,
  DidCommProofEventTypes,
  DidCommProofState,
} from '../../../../../../didcomm/src'
import type { AnonCredsTestsAgent } from '../../../../../tests/legacyAnonCredsSetup'
import {
  getAnonCredsIndyModules,
  issueLegacyAnonCredsCredential,
  prepareForAnonCredsIssuance,
  setupAnonCredsTests,
} from '../../../../../tests/legacyAnonCredsSetup'
import { DidCommCredentialV1Preview } from '../../../credentials/v1'
import {
  DidCommPresentationV1Message,
  DidCommProposePresentationV1Message,
  DidCommRequestPresentationV1Message,
} from '../messages'

describe('V1 Proofs - Connectionless - Indy', () => {
  let agents: Agent[]

  afterEach(async () => {
    for (const agent of agents) {
      await agent.shutdown()
    }
  })

  // new method to test the return route and mediator together
  const connectionlessTest = async (returnRoute?: boolean) => {
    const {
      holderAgent: aliceAgent,
      issuerAgent: faberAgent,
      holderReplay: aliceReplay,
      credentialDefinitionId,
      issuerReplay: faberReplay,
      issuerHolderConnectionId: faberConnectionId,
    } = await setupAnonCredsTests({
      issuerName: 'Faber v1 connection-less Proofs - Never',
      holderName: 'Alice v1 connection-less Proofs - Never',
      autoAcceptProofs: DidCommAutoAcceptProof.Never,
      attributeNames: ['name', 'age'],
    })

    // FIXME: We should reuse anoncreds crypto object as it will speed up tests significantly
    await issueLegacyAnonCredsCredential({
      issuerAgent: faberAgent,
      holderAgent: aliceAgent,
      issuerReplay: faberReplay,
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
            value: '99',
          },
        ],
      },
    })

    agents = [aliceAgent, faberAgent]
    testLogger.test('Faber sends presentation request to Alice')

    let { proofRecord: faberProofExchangeRecord, message } = await faberAgent.didcomm.proofs.createRequest({
      protocolVersion: 'v1',
      proofFormats: {
        indy: {
          name: 'test-proof-request',
          version: '1.0',
          requested_attributes: {
            name: {
              name: 'name',
              restrictions: [
                {
                  cred_def_id: credentialDefinitionId,
                },
              ],
            },
          },
          requested_predicates: {
            age: {
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

    const outOfBandRecord = await faberAgent.didcomm.oob.createInvitation({
      messages: [message],
      handshake: false,
    })
    await aliceAgent.didcomm.oob.receiveInvitation(outOfBandRecord.outOfBandInvitation, { label: 'alice' })

    testLogger.test('Alice waits for presentation request from Faber')
    let aliceProofExchangeRecord = await waitForProofExchangeRecordSubject(aliceReplay, {
      state: DidCommProofState.RequestReceived,
    })

    testLogger.test('Alice accepts presentation request from Faber')
    const requestedCredentials = await aliceAgent.didcomm.proofs.selectCredentialsForRequest({
      proofExchangeRecordId: aliceProofExchangeRecord.id,
    })

    await aliceAgent.didcomm.proofs.acceptRequest({
      proofExchangeRecordId: aliceProofExchangeRecord.id,
      useReturnRoute: returnRoute,
      proofFormats: { indy: requestedCredentials.proofFormats.indy },
    })

    testLogger.test('Faber waits for presentation from Alice')
    faberProofExchangeRecord = await waitForProofExchangeRecordSubject(faberReplay, {
      threadId: aliceProofExchangeRecord.threadId,
      state: DidCommProofState.PresentationReceived,
    })

    const sentPresentationMessage = aliceAgent.didcomm.proofs.findPresentationMessage(aliceProofExchangeRecord.id)
    // assert presentation is valid
    expect(faberProofExchangeRecord.isVerified).toBe(true)

    // Faber accepts presentation
    await faberAgent.didcomm.proofs.acceptPresentation({ proofExchangeRecordId: faberProofExchangeRecord.id })

    // Alice waits till it receives presentation ack
    aliceProofExchangeRecord = await waitForProofExchangeRecordSubject(aliceReplay, {
      threadId: aliceProofExchangeRecord.threadId,
      state: DidCommProofState.Done,
    })
    return sentPresentationMessage
  }

  test('Faber starts with connection-less proof requests to Alice', async () => {
    await connectionlessTest()
  })

  test('Faber starts with connection-less proof requests to Alice with auto-accept enabled', async () => {
    const {
      holderAgent: aliceAgent,
      issuerAgent: faberAgent,
      holderReplay: aliceReplay,
      credentialDefinitionId,
      issuerReplay: faberReplay,
      issuerHolderConnectionId: faberConnectionId,
    } = await setupAnonCredsTests({
      issuerName: 'Faber v1 connection-less Proofs - Always',
      holderName: 'Alice v1 connection-less Proofs - Always',
      autoAcceptProofs: DidCommAutoAcceptProof.Always,
      attributeNames: ['name', 'age'],
    })

    await issueLegacyAnonCredsCredential({
      issuerAgent: faberAgent,
      holderAgent: aliceAgent,
      issuerReplay: faberReplay,
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
            value: '99',
          },
        ],
      },
    })

    agents = [aliceAgent, faberAgent]

    const { message, proofRecord: faberProofExchangeRecord } = await faberAgent.didcomm.proofs.createRequest({
      protocolVersion: 'v1',
      proofFormats: {
        indy: {
          name: 'test-proof-request',
          version: '1.0',
          requested_attributes: {
            name: {
              name: 'name',
              restrictions: [
                {
                  cred_def_id: credentialDefinitionId,
                },
              ],
            },
          },
          requested_predicates: {
            age: {
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
      autoAcceptProof: DidCommAutoAcceptProof.ContentApproved,
    })

    const { invitationUrl } = await faberAgent.didcomm.oob.createLegacyConnectionlessInvitation({
      recordId: faberProofExchangeRecord.id,
      message,
      domain: 'https://a-domain.com',
    })

    await aliceAgent.didcomm.oob.receiveInvitationFromUrl(invitationUrl, { label: 'alice' })

    await waitForProofExchangeRecordSubject(aliceReplay, {
      state: DidCommProofState.Done,
      threadId: message.threadId,
    })

    await waitForProofExchangeRecordSubject(faberReplay, {
      state: DidCommProofState.Done,
      threadId: message.threadId,
    })
  })

  test('Faber starts with connection-less proof requests to Alice with auto-accept enabled and without an outbound transport', async () => {
    const {
      holderAgent: aliceAgent,
      issuerAgent: faberAgent,
      holderReplay: aliceReplay,
      credentialDefinitionId,
      issuerReplay: faberReplay,
      issuerHolderConnectionId: faberConnectionId,
    } = await setupAnonCredsTests({
      issuerName: 'Faber v1 connection-less Proofs - Always',
      holderName: 'Alice v1 connection-less Proofs - Always',
      autoAcceptProofs: DidCommAutoAcceptProof.Always,
      attributeNames: ['name', 'age'],
    })

    await issueLegacyAnonCredsCredential({
      issuerAgent: faberAgent,
      holderAgent: aliceAgent,
      issuerReplay: faberReplay,
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
            value: '99',
          },
        ],
      },
    })

    agents = [aliceAgent, faberAgent]

    const { message } = await faberAgent.didcomm.proofs.createRequest({
      protocolVersion: 'v1',
      proofFormats: {
        indy: {
          name: 'test-proof-request',
          version: '1.0',
          requested_attributes: {
            name: {
              name: 'name',
              restrictions: [
                {
                  cred_def_id: credentialDefinitionId,
                },
              ],
            },
          },
          requested_predicates: {
            age: {
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
      autoAcceptProof: DidCommAutoAcceptProof.ContentApproved,
    })

    const { invitationUrl, message: requestMessage } =
      await faberAgent.didcomm.oob.createLegacyConnectionlessInvitation({
        message,
        domain: 'https://a-domain.com',
      })

    for (const transport of faberAgent.didcomm.outboundTransports) {
      await faberAgent.didcomm.unregisterOutboundTransport(transport)
    }

    await aliceAgent.didcomm.oob.receiveInvitationFromUrl(invitationUrl, { label: 'alice' })

    await waitForProofExchangeRecordSubject(aliceReplay, {
      state: DidCommProofState.Done,
      threadId: requestMessage.threadId,
    })

    await waitForProofExchangeRecordSubject(faberReplay, {
      state: DidCommProofState.Done,
      threadId: requestMessage.threadId,
    })
  })

  test('Faber starts with connection-less proof requests to Alice with auto-accept enabled and both agents having a mediator', async () => {
    testLogger.test('Faber sends presentation request to Alice')

    const credentialPreview = DidCommCredentialV1Preview.fromRecord({
      name: 'John',
      age: '99',
    })

    const unique = uuid().substring(0, 4)

    const mediatorAgentOptions = getAgentOptions(
      `Connectionless proofs with mediator Mediator-${unique}`,
      {
        endpoints: ['rxjs:mediator'],
        mediator: {
          autoAcceptMediationRequests: true,
        },
      },
      {},
      {},
      { requireDidcomm: true }
    )

    const mediatorMessages = new Subject<SubjectMessage>()
    const subjectMap = { 'rxjs:mediator': mediatorMessages }

    // Initialize mediator
    const mediatorAgent = new Agent(mediatorAgentOptions)
    mediatorAgent.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    mediatorAgent.didcomm.registerInboundTransport(new SubjectInboundTransport(mediatorMessages))
    await mediatorAgent.initialize()

    const faberMediationOutOfBandRecord = await mediatorAgent.didcomm.oob.createInvitation({
      label: 'faber invitation',
      handshakeProtocols: [DidCommHandshakeProtocol.Connections],
    })

    const aliceMediationOutOfBandRecord = await mediatorAgent.didcomm.oob.createInvitation({
      label: 'alice invitation',
      handshakeProtocols: [DidCommHandshakeProtocol.Connections],
    })

    const faberAgentOptions = getAgentOptions(
      `Connectionless proofs with mediator Faber-${unique}`,
      {},
      {},
      {
        ...getAnonCredsIndyModules({
          autoAcceptProofs: DidCommAutoAcceptProof.Always,
          extraDidCommConfig: {
            mediationRecipient: {
              mediatorInvitationUrl: faberMediationOutOfBandRecord.outOfBandInvitation.toUrl({
                domain: 'https://example.com',
              }),
              mediatorPickupStrategy: DidCommMediatorPickupStrategy.PickUpV1,
            },
          },
        }),
      },
      { requireDidcomm: true }
    )

    const aliceAgentOptions = getAgentOptions(
      `Connectionless proofs with mediator Alice-${unique}`,
      {},
      {},
      {
        ...getAnonCredsIndyModules({
          autoAcceptProofs: DidCommAutoAcceptProof.Always,
          extraDidCommConfig: {
            mediationRecipient: {
              mediatorInvitationUrl: aliceMediationOutOfBandRecord.outOfBandInvitation.toUrl({
                domain: 'https://example.com',
              }),
              mediatorPickupStrategy: DidCommMediatorPickupStrategy.PickUpV1,
            },
          },
        }),
      },
      { requireDidcomm: true }
    )

    const faberAgent = new Agent(faberAgentOptions)
    faberAgent.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await faberAgent.initialize()

    const aliceAgent = new Agent(aliceAgentOptions)
    aliceAgent.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await aliceAgent.initialize()

    const [faberReplay, aliceReplay] = setupEventReplaySubjects(
      [faberAgent, aliceAgent],
      [DidCommCredentialEventTypes.DidCommCredentialStateChanged, DidCommProofEventTypes.ProofStateChanged]
    )

    agents = [aliceAgent, faberAgent, mediatorAgent]

    const { credentialDefinition } = await prepareForAnonCredsIssuance(faberAgent, {
      attributeNames: ['name', 'age', 'image_0', 'image_1'],
    })

    const [faberConnection, aliceConnection] = await makeConnection(faberAgent, aliceAgent)
    expect(faberConnection.isReady).toBe(true)
    expect(aliceConnection.isReady).toBe(true)

    await issueLegacyAnonCredsCredential({
      issuerAgent: faberAgent as AnonCredsTestsAgent,
      issuerReplay: faberReplay,
      issuerHolderConnectionId: faberConnection.id,
      holderAgent: aliceAgent as AnonCredsTestsAgent,
      holderReplay: aliceReplay,
      offer: {
        credentialDefinitionId: credentialDefinition.credentialDefinitionId,
        attributes: credentialPreview.attributes,
        linkedAttachments: [
          new DidCommLinkedAttachment({
            name: 'image_0',
            attachment: new DidCommAttachment({
              filename: 'picture-of-a-cat.png',
              data: new DidCommAttachmentData({ base64: 'cGljdHVyZSBvZiBhIGNhdA==' }),
            }),
          }),
          new DidCommLinkedAttachment({
            name: 'image_1',
            attachment: new DidCommAttachment({
              filename: 'picture-of-a-dog.png',
              data: new DidCommAttachmentData({ base64: 'UGljdHVyZSBvZiBhIGRvZw==' }),
            }),
          }),
        ],
      },
    })

    const { message, proofRecord: faberProofExchangeRecord } = await faberAgent.didcomm.proofs.createRequest({
      protocolVersion: 'v1',
      proofFormats: {
        indy: {
          name: 'test-proof-request',
          version: '1.0',
          requested_attributes: {
            name: {
              name: 'name',
              restrictions: [
                {
                  cred_def_id: credentialDefinition.credentialDefinitionId,
                },
              ],
            },
          },
          requested_predicates: {
            age: {
              name: 'age',
              p_type: '>=',
              p_value: 50,
              restrictions: [
                {
                  cred_def_id: credentialDefinition.credentialDefinitionId,
                },
              ],
            },
          },
        },
      },
      autoAcceptProof: DidCommAutoAcceptProof.ContentApproved,
    })

    const { message: requestMessage, invitationUrl } =
      await faberAgent.didcomm.oob.createLegacyConnectionlessInvitation({
        recordId: faberProofExchangeRecord.id,
        message,
        domain: 'https://a-domain.com',
      })

    const mediationRecord = await faberAgent.didcomm.mediationRecipient.findDefaultMediator()
    if (!mediationRecord) {
      throw new Error('Faber agent has no default mediator')
    }

    expect(requestMessage).toMatchObject({
      service: {
        recipientKeys: [expect.any(String)],
        routingKeys: mediationRecord.routingKeys,
        serviceEndpoint: mediationRecord.endpoint,
      },
    })

    await aliceAgent.didcomm.oob.receiveInvitationFromUrl(invitationUrl, { label: 'alice' })

    await waitForProofExchangeRecordSubject(aliceReplay, {
      state: DidCommProofState.Done,
      threadId: requestMessage.threadId,
    })

    await waitForProofExchangeRecordSubject(faberReplay, {
      state: DidCommProofState.Done,
      threadId: requestMessage.threadId,
    })

    await aliceAgent.didcomm.mediationRecipient.stopMessagePickup()
    await faberAgent.didcomm.mediationRecipient.stopMessagePickup()
  })

  test('Alice Creates oob proof proposal for Faber', async () => {
    const {
      holderAgent: aliceAgent,
      issuerAgent: faberAgent,
      holderReplay: aliceReplay,
      credentialDefinitionId,
      issuerReplay: faberReplay,
      issuerHolderConnectionId: faberConnectionId,
    } = await setupAnonCredsTests({
      issuerName: 'Faber v1 connection-less Propose Proofs',
      holderName: 'Alice v1 connection-less Propose Proofs',
      autoAcceptProofs: DidCommAutoAcceptProof.Never,
      attributeNames: ['name', 'age'],
    })

    agents = [aliceAgent, faberAgent]

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
    testLogger.test('Alice creates oob proof proposal for Faber')
    const { message } = await aliceAgent.didcomm.proofs.createProofProposal({
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
    const { outOfBandInvitation } = await aliceAgent.didcomm.oob.createInvitation({
      messages: [message],
      autoAcceptConnection: true,
    })
    await faberAgent.didcomm.oob.receiveInvitation(outOfBandInvitation, { label: 'faber' })
    testLogger.test('Faber waits for proof proposal message from Alice')
    let faberProofExchangeRecord = await waitForProofExchangeRecordSubject(faberReplay, {
      state: DidCommProofState.ProposalReceived,
    })

    // Faber accepts the presentation proposal from Alice
    testLogger.test('Faber accepts presentation proposal from Alice')
    faberProofExchangeRecord = await faberAgent.didcomm.proofs.acceptProposal({
      proofExchangeRecordId: faberProofExchangeRecord.id,
    })

    // ALice waits for presentation request from Faber
    testLogger.test('Alice waits for presentation request from Faber')
    let aliceProofExchangeRecord = await waitForProofExchangeRecordSubject(aliceReplay, {
      state: DidCommProofState.RequestReceived,
    })
    expect(aliceProofExchangeRecord.connectionId).not.toBeNull()

    // Alice retrieves the requested credentials and accepts the presentation
    testLogger.test('Alice accepts presentation request from Faber')
    const requestedCredentials = await aliceAgent.didcomm.proofs.selectCredentialsForRequest({
      proofExchangeRecordId: aliceProofExchangeRecord.id,
    })
    await aliceAgent.didcomm.proofs.acceptRequest({
      proofExchangeRecordId: aliceProofExchangeRecord.id,
      proofFormats: { indy: requestedCredentials.proofFormats.indy },
    })

    // Faber waits for the presentation from Alice
    testLogger.test('Faber waits for presentation from Alice')
    faberProofExchangeRecord = await waitForProofExchangeRecordSubject(faberReplay, {
      threadId: aliceProofExchangeRecord.threadId,
      state: DidCommProofState.PresentationReceived,
    })

    // Faber accepts the presentation provided by Alice
    testLogger.test('Faber accepts the presentation provided by Alice')
    await faberAgent.didcomm.proofs.acceptPresentation({
      proofExchangeRecordId: faberProofExchangeRecord.id,
    })

    // Alice waits utils she received a presentation acknowledgement
    testLogger.test('Alice waits until she receives a presentation acknowledgement')
    aliceProofExchangeRecord = await waitForProofExchangeRecordSubject(aliceReplay, {
      threadId: aliceProofExchangeRecord.threadId,
      state: DidCommProofState.Done,
    })

    const proposalMessage = await aliceAgent.didcomm.proofs.findProposalMessage(aliceProofExchangeRecord.id)
    const requestMessage = await aliceAgent.didcomm.proofs.findRequestMessage(aliceProofExchangeRecord.id)
    const presentationMessage = await aliceAgent.didcomm.proofs.findPresentationMessage(aliceProofExchangeRecord.id)

    expect(proposalMessage).toBeInstanceOf(DidCommProposePresentationV1Message)
    expect(requestMessage).toBeInstanceOf(DidCommRequestPresentationV1Message)
    expect(presentationMessage).toBeInstanceOf(DidCommPresentationV1Message)
  })
})
