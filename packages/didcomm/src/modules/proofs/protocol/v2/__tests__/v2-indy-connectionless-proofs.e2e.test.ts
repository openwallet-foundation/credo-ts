import { Subject } from 'rxjs'
import type { SubjectMessage } from '../../../../../../../../tests/transport/SubjectInboundTransport'
import { SubjectInboundTransport } from '../../../../../../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../../../../../../tests/transport/SubjectOutboundTransport'
import { DidCommCredentialV1Preview } from '../../../../../../../anoncreds/src'
import type { AnonCredsTestsAgent } from '../../../../../../../anoncreds/tests/legacyAnonCredsSetup'
import {
  getAnonCredsIndyModules,
  issueLegacyAnonCredsCredential,
  prepareForAnonCredsIssuance,
  setupAnonCredsTests,
} from '../../../../../../../anoncreds/tests/legacyAnonCredsSetup'
import { Agent } from '../../../../../../../core/src/index'
import { uuid } from '../../../../../../../core/src/utils/uuid'
import {
  getAgentOptions,
  makeConnection,
  setupEventReplaySubjects,
  testLogger,
  waitForProofExchangeRecord,
  waitForProofExchangeRecordSubject,
} from '../../../../../../../core/tests'
import {
  DidCommAutoAcceptProof,
  DidCommCredentialEventTypes,
  DidCommHandshakeProtocol,
  DidCommMediatorPickupStrategy,
  DidCommPresentationV2Message,
  DidCommProofEventTypes,
  DidCommProofState,
  DidCommProposePresentationV2Message,
  DidCommRequestPresentationV2Message,
} from '../../../../../../src'

describe('V2 Connectionless Proofs - Indy', () => {
  let agents: Agent[]

  afterEach(async () => {
    for (const agent of agents) {
      await agent.shutdown()
    }
  })

  const connectionlessTest = async (returnRoute?: boolean) => {
    const {
      issuerAgent: faberAgent,
      issuerReplay: faberReplay,
      holderAgent: aliceAgent,
      holderReplay: aliceReplay,
      credentialDefinitionId,
      issuerHolderConnectionId: faberConnectionId,
    } = await setupAnonCredsTests({
      issuerName: 'Faber connection-less Proofs v2',
      holderName: 'Alice connection-less Proofs v2',
      autoAcceptProofs: DidCommAutoAcceptProof.Never,
      attributeNames: ['name', 'age'],
    })

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

    agents = [aliceAgent, faberAgent]
    testLogger.test('Faber sends presentation request to Alice')

    let { proofRecord: faberProofExchangeRecord, message } = await faberAgent.didcomm.proofs.createRequest({
      protocolVersion: 'v2',
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

    const { invitationUrl } = await faberAgent.didcomm.oob.createLegacyConnectionlessInvitation({
      recordId: faberProofExchangeRecord.id,
      message,
      domain: 'https://a-domain.com',
    })

    await aliceAgent.didcomm.oob.receiveInvitationFromUrl(invitationUrl, { label: 'alice' })

    testLogger.test('Alice waits for presentation request from Faber')
    let aliceProofExchangeRecord = await waitForProofExchangeRecordSubject(aliceReplay, {
      state: DidCommProofState.RequestReceived,
    })

    testLogger.test('Alice accepts presentation request from Faber')
    const requestedCredentials = await aliceAgent.didcomm.proofs.selectCredentialsForRequest({
      proofExchangeRecordId: aliceProofExchangeRecord.id,
    })

    aliceProofExchangeRecord = await aliceAgent.didcomm.proofs.acceptRequest({
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

    // Alice waits until it receives presentation ack
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
    testLogger.test('Faber sends presentation request to Alice')

    const {
      issuerAgent: faberAgent,
      issuerReplay: faberReplay,
      holderAgent: aliceAgent,
      holderReplay: aliceReplay,
      credentialDefinitionId,
      issuerHolderConnectionId: faberConnectionId,
    } = await setupAnonCredsTests({
      issuerName: 'Faber connection-less Proofs v2 - Auto Accept',
      holderName: 'Alice connection-less Proofs v2 - Auto Accept',
      autoAcceptProofs: DidCommAutoAcceptProof.Always,
      attributeNames: ['name', 'age'],
    })

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

    agents = [aliceAgent, faberAgent]

    const { message, proofRecord: faberProofExchangeRecord } = await faberAgent.didcomm.proofs.createRequest({
      protocolVersion: 'v2',
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
        recordId: faberProofExchangeRecord.id,
        message,
        domain: 'https://a-domain.com',
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
  })

  test('Faber starts with connection-less proof requests to Alice with auto-accept enabled and both agents having a mediator', async () => {
    testLogger.test('Faber sends presentation request to Alice')

    const credentialPreview = DidCommCredentialV1Preview.fromRecord({
      name: 'John',
      age: '99',
    })

    const unique = uuid().substring(0, 4)

    const mediatorOptions = getAgentOptions(
      `Connectionless proofs with mediator Mediator-${unique}`,
      {},
      {},
      {
        ...getAnonCredsIndyModules({
          autoAcceptProofs: DidCommAutoAcceptProof.Always,
          extraDidCommConfig: {
            endpoints: ['rxjs:mediator'],
            mediator: { autoAcceptMediationRequests: true },
          },
        }),
      },
      { requireDidcomm: true }
    )

    const mediatorMessages = new Subject<SubjectMessage>()
    const subjectMap = { 'rxjs:mediator': mediatorMessages }

    // Initialize mediator
    const mediatorAgent = new Agent(mediatorOptions)
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

    const faberOptions = getAgentOptions(
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

    const aliceOptions = getAgentOptions(
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

    const faberAgent = new Agent(faberOptions)
    faberAgent.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await faberAgent.initialize()

    const aliceAgent = new Agent(aliceOptions)
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

    const [faberConnection] = await makeConnection(faberAgent, aliceAgent)

    // issue credential
    await issueLegacyAnonCredsCredential({
      issuerAgent: faberAgent as AnonCredsTestsAgent,
      issuerReplay: faberReplay,
      issuerHolderConnectionId: faberConnection.id,
      holderAgent: aliceAgent as AnonCredsTestsAgent,
      holderReplay: aliceReplay,
      offer: {
        credentialDefinitionId: credentialDefinition.credentialDefinitionId,
        attributes: credentialPreview.attributes,
      },
    })

    const { message, proofRecord: faberProofExchangeRecord } = await faberAgent.didcomm.proofs.createRequest({
      protocolVersion: 'v2',
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
    if (!mediationRecord) throw new Error('Faber agent has no default mediator')

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
  })

  test('Faber starts with connection-less proof requests to Alice with auto-accept enabled and without an outbound transport', async () => {
    testLogger.test('Faber sends presentation request to Alice')

    const {
      issuerAgent: faberAgent,
      issuerReplay: faberReplay,
      holderAgent: aliceAgent,
      holderReplay: aliceReplay,
      credentialDefinitionId,
      issuerHolderConnectionId: faberConnectionId,
    } = await setupAnonCredsTests({
      issuerName: 'Faber connection-less Proofs v2 - Auto Accept',
      holderName: 'Alice connection-less Proofs v2 - Auto Accept',
      autoAcceptProofs: DidCommAutoAcceptProof.Always,
      attributeNames: ['name', 'age'],
    })

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

    agents = [aliceAgent, faberAgent]

    const { message, proofRecord: faberProofExchangeRecord } = await faberAgent.didcomm.proofs.createRequest({
      protocolVersion: 'v2',
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

    const { message: requestMessage, invitationUrl } =
      await faberAgent.didcomm.oob.createLegacyConnectionlessInvitation({
        recordId: faberProofExchangeRecord.id,
        message,
        domain: 'rxjs:faber',
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

  test('Faber starts with connection-less proof requests to Alice but gets Problem Reported', async () => {
    testLogger.test('Faber sends presentation request to Alice')

    const {
      issuerAgent: faberAgent,
      issuerReplay: faberReplay,
      holderAgent: aliceAgent,
      holderReplay: aliceReplay,
      credentialDefinitionId,
      issuerHolderConnectionId: faberConnectionId,
    } = await setupAnonCredsTests({
      issuerName: 'Faber connection-less Proofs v2 - Reject Request',
      holderName: 'Alice connection-less Proofs v2 - Reject Request',
      autoAcceptProofs: DidCommAutoAcceptProof.Never,
      attributeNames: ['name', 'age'],
    })

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

    agents = [aliceAgent, faberAgent]

    const { message, proofRecord: faberProofExchangeRecord } = await faberAgent.didcomm.proofs.createRequest({
      protocolVersion: 'v2',
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
          requested_predicates: {},
        },
      },
      autoAcceptProof: DidCommAutoAcceptProof.ContentApproved,
    })

    const { message: requestMessage, invitationUrl } =
      await faberAgent.didcomm.oob.createLegacyConnectionlessInvitation({
        recordId: faberProofExchangeRecord.id,
        message,
        domain: 'rxjs:faber',
      })

    for (const transport of faberAgent.didcomm.outboundTransports) {
      await faberAgent.didcomm.unregisterOutboundTransport(transport)
    }

    const aliceProofExchangeRecordPromise = waitForProofExchangeRecord(aliceAgent, {
      state: DidCommProofState.RequestReceived,
    })

    await aliceAgent.didcomm.oob.receiveInvitationFromUrl(invitationUrl, { label: 'alice' })
    const aliceProofExchangeRecord = await aliceProofExchangeRecordPromise

    await aliceAgent.didcomm.proofs.declineRequest({
      proofExchangeRecordId: aliceProofExchangeRecord.id,
      sendProblemReport: true,
    })

    await waitForProofExchangeRecordSubject(aliceReplay, {
      state: DidCommProofState.Declined,
      threadId: requestMessage.threadId,
    })

    await waitForProofExchangeRecordSubject(faberReplay, {
      state: DidCommProofState.Abandoned,
      threadId: requestMessage.threadId,
    })
  })

  test('Alice start with oob proof proposal for Faber with auto-accept enabled', async () => {
    const {
      issuerAgent: faberAgent,
      issuerReplay: faberReplay,
      holderAgent: aliceAgent,
      holderReplay: aliceReplay,
      credentialDefinitionId,
      issuerHolderConnectionId: faberConnectionId,
    } = await setupAnonCredsTests({
      issuerName: 'Faber oob Proofs proposal v2 - Auto Accept',
      holderName: 'Alice oob Proofs proposal v2 - Auto Accept',
      autoAcceptProofs: DidCommAutoAcceptProof.Always,
      attributeNames: ['name', 'age'],
    })
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
    agents = [aliceAgent, faberAgent]
    testLogger.test('Alice creates oob proof proposal for faber')
    const { message } = await aliceAgent.didcomm.proofs.createProofProposal({
      protocolVersion: 'v2',
      proofFormats: {
        indy: {
          name: 'abc',
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
              name: 'age',
              predicate: '>=',
              threshold: 50,
              credentialDefinitionId,
            },
          ],
        },
      },
      autoAcceptProof: DidCommAutoAcceptProof.ContentApproved,
    })

    const { outOfBandInvitation } = await aliceAgent.didcomm.oob.createInvitation({
      messages: [message],
      autoAcceptConnection: true,
    })
    await faberAgent.didcomm.oob.receiveInvitation(outOfBandInvitation, { label: 'faber' })

    const aliceProofExchangeRecord = await waitForProofExchangeRecordSubject(aliceReplay, {
      state: DidCommProofState.Done,
      threadId: message.id,
    })
    const faberProofExchangeRecord = await waitForProofExchangeRecordSubject(faberReplay, {
      state: DidCommProofState.Done,
      threadId: message.id,
    })
    expect(aliceProofExchangeRecord.connectionId).not.toBeNull()
    const proposalMessageFaber = await faberAgent.didcomm.proofs.findProposalMessage(faberProofExchangeRecord.id)
    const requestMessageFaber = await faberAgent.didcomm.proofs.findRequestMessage(faberProofExchangeRecord.id)
    const presentationMessageFaber = await faberAgent.didcomm.proofs.findPresentationMessage(
      faberProofExchangeRecord.id
    )
    expect(proposalMessageFaber).toBeInstanceOf(DidCommProposePresentationV2Message)
    expect(requestMessageFaber).toBeInstanceOf(DidCommRequestPresentationV2Message)
    expect(presentationMessageFaber).toBeInstanceOf(DidCommPresentationV2Message)

    const proposalMessage = await aliceAgent.didcomm.proofs.findProposalMessage(aliceProofExchangeRecord.id)
    const requestMessage = await aliceAgent.didcomm.proofs.findRequestMessage(aliceProofExchangeRecord.id)
    const presentationMessage = await aliceAgent.didcomm.proofs.findPresentationMessage(aliceProofExchangeRecord.id)
    expect(proposalMessage).toBeInstanceOf(DidCommProposePresentationV2Message)
    expect(requestMessage).toBeInstanceOf(DidCommRequestPresentationV2Message)
    expect(presentationMessage).toBeInstanceOf(DidCommPresentationV2Message)
  })
})
