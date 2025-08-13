import type { SubjectMessage } from '../../../../../../../tests/transport/SubjectInboundTransport'
import type { AnonCredsTestsAgent } from '../../../../../tests/legacyAnonCredsSetup'

import { Subject } from 'rxjs'

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
  Attachment,
  AttachmentData,
  DidCommAutoAcceptProof,
  DidCommCredentialEventTypes,
  DidCommHandshakeProtocol,
  LinkedAttachment,
  DidCommMediationRecipientModule,
  DidCommMediatorModule,
  DidCommMediatorPickupStrategy,
  DidCommProofEventTypes,
  DidCommProofState,
} from '../../../../../../didcomm/src'
import {
  getAnonCredsIndyModules,
  issueLegacyAnonCredsCredential,
  prepareForAnonCredsIssuance,
  setupAnonCredsTests,
} from '../../../../../tests/legacyAnonCredsSetup'
import { V1CredentialPreview } from '../../../credentials/v1'

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

    let { proofRecord: faberProofExchangeRecord, message } = await faberAgent.modules.proofs.createRequest({
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

    const outOfBandRecord = await faberAgent.modules.oob.createInvitation({
      messages: [message],
      handshake: false,
    })
    await aliceAgent.modules.oob.receiveInvitation(outOfBandRecord.outOfBandInvitation)

    testLogger.test('Alice waits for presentation request from Faber')
    let aliceProofExchangeRecord = await waitForProofExchangeRecordSubject(aliceReplay, {
      state: DidCommProofState.RequestReceived,
    })

    testLogger.test('Alice accepts presentation request from Faber')
    const requestedCredentials = await aliceAgent.modules.proofs.selectCredentialsForRequest({
      proofRecordId: aliceProofExchangeRecord.id,
    })

    await aliceAgent.modules.proofs.acceptRequest({
      proofRecordId: aliceProofExchangeRecord.id,
      useReturnRoute: returnRoute,
      proofFormats: { indy: requestedCredentials.proofFormats.indy },
    })

    testLogger.test('Faber waits for presentation from Alice')
    faberProofExchangeRecord = await waitForProofExchangeRecordSubject(faberReplay, {
      threadId: aliceProofExchangeRecord.threadId,
      state: DidCommProofState.PresentationReceived,
    })

    const sentPresentationMessage = aliceAgent.modules.proofs.findPresentationMessage(aliceProofExchangeRecord.id)
    // assert presentation is valid
    expect(faberProofExchangeRecord.isVerified).toBe(true)

    // Faber accepts presentation
    await faberAgent.modules.proofs.acceptPresentation({ proofRecordId: faberProofExchangeRecord.id })

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

    const { message, proofRecord: faberProofExchangeRecord } = await faberAgent.modules.proofs.createRequest({
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

    const { invitationUrl } = await faberAgent.modules.oob.createLegacyConnectionlessInvitation({
      recordId: faberProofExchangeRecord.id,
      message,
      domain: 'https://a-domain.com',
    })

    await aliceAgent.modules.oob.receiveInvitationFromUrl(invitationUrl)

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

    const { message } = await faberAgent.modules.proofs.createRequest({
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
      await faberAgent.modules.oob.createLegacyConnectionlessInvitation({
        message,
        domain: 'https://a-domain.com',
      })

    for (const transport of faberAgent.modules.didcomm.outboundTransports) {
      await faberAgent.modules.didcomm.unregisterOutboundTransport(transport)
    }

    await aliceAgent.modules.oob.receiveInvitationFromUrl(invitationUrl)

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

    const credentialPreview = V1CredentialPreview.fromRecord({
      name: 'John',
      age: '99',
    })

    const unique = uuid().substring(0, 4)

    const mediatorAgentOptions = getAgentOptions(
      `Connectionless proofs with mediator Mediator-${unique}`,
      {
        endpoints: ['rxjs:mediator'],
      },
      {},
      {
        mediator: new DidCommMediatorModule({
          autoAcceptMediationRequests: true,
        }),
      },
      { requireDidcomm: true }
    )

    const mediatorMessages = new Subject<SubjectMessage>()
    const subjectMap = { 'rxjs:mediator': mediatorMessages }

    // Initialize mediator
    const mediatorAgent = new Agent(mediatorAgentOptions)
    mediatorAgent.modules.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    mediatorAgent.modules.didcomm.registerInboundTransport(new SubjectInboundTransport(mediatorMessages))
    await mediatorAgent.initialize()

    const faberMediationOutOfBandRecord = await mediatorAgent.modules.oob.createInvitation({
      label: 'faber invitation',
      handshakeProtocols: [DidCommHandshakeProtocol.Connections],
    })

    const aliceMediationOutOfBandRecord = await mediatorAgent.modules.oob.createInvitation({
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
        }),
        mediationRecipient: new DidCommMediationRecipientModule({
          mediatorInvitationUrl: faberMediationOutOfBandRecord.outOfBandInvitation.toUrl({
            domain: 'https://example.com',
          }),
          mediatorPickupStrategy: DidCommMediatorPickupStrategy.PickUpV1,
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
        }),
        mediationRecipient: new DidCommMediationRecipientModule({
          mediatorInvitationUrl: aliceMediationOutOfBandRecord.outOfBandInvitation.toUrl({
            domain: 'https://example.com',
          }),
          mediatorPickupStrategy: DidCommMediatorPickupStrategy.PickUpV1,
        }),
      },
      { requireDidcomm: true }
    )

    const faberAgent = new Agent(faberAgentOptions)
    faberAgent.modules.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await faberAgent.initialize()

    const aliceAgent = new Agent(aliceAgentOptions)
    aliceAgent.modules.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
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
          new LinkedAttachment({
            name: 'image_0',
            attachment: new Attachment({
              filename: 'picture-of-a-cat.png',
              data: new AttachmentData({ base64: 'cGljdHVyZSBvZiBhIGNhdA==' }),
            }),
          }),
          new LinkedAttachment({
            name: 'image_1',
            attachment: new Attachment({
              filename: 'picture-of-a-dog.png',
              data: new AttachmentData({ base64: 'UGljdHVyZSBvZiBhIGRvZw==' }),
            }),
          }),
        ],
      },
    })

    const { message, proofRecord: faberProofExchangeRecord } = await faberAgent.modules.proofs.createRequest({
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
      await faberAgent.modules.oob.createLegacyConnectionlessInvitation({
        recordId: faberProofExchangeRecord.id,
        message,
        domain: 'https://a-domain.com',
      })

    const mediationRecord = await faberAgent.modules.mediationRecipient.findDefaultMediator()
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

    await aliceAgent.modules.oob.receiveInvitationFromUrl(invitationUrl)

    await waitForProofExchangeRecordSubject(aliceReplay, {
      state: DidCommProofState.Done,
      threadId: requestMessage.threadId,
    })

    await waitForProofExchangeRecordSubject(faberReplay, {
      state: DidCommProofState.Done,
      threadId: requestMessage.threadId,
    })

    await aliceAgent.modules.mediationRecipient.stopMessagePickup()
    await faberAgent.modules.mediationRecipient.stopMessagePickup()
  })
})
