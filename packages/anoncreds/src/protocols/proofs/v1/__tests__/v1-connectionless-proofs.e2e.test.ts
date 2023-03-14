import type { SubjectMessage } from '../../../../../../../tests/transport/SubjectInboundTransport'

import { Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../../../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../../../../../tests/transport/SubjectOutboundTransport'
import {
  CredentialEventTypes,
  Agent,
  AutoAcceptProof,
  ProofState,
  HandshakeProtocol,
  MediatorPickupStrategy,
  LinkedAttachment,
  Attachment,
  AttachmentData,
  ProofEventTypes,
} from '../../../../../../core/src'
import { uuid } from '../../../../../../core/src/utils/uuid'
import {
  testLogger,
  waitForProofExchangeRecordSubject,
  getAgentOptions,
  makeConnection,
  setupEventReplaySubjects,
} from '../../../../../../core/tests'
import { getIndySdkModules } from '../../../../../../indy-sdk/tests/setupIndySdkModule'
import {
  getLegacyAnonCredsModules,
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
      await agent.wallet.delete()
    }
  })

  test('Faber starts with connection-less proof requests to Alice', async () => {
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
      autoAcceptProofs: AutoAcceptProof.Never,
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
    testLogger.test('Faber sends presentation request to Alice')

    // eslint-disable-next-line prefer-const
    let { proofRecord: faberProofExchangeRecord, message } = await faberAgent.proofs.createRequest({
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

    const { message: requestMessage } = await faberAgent.oob.createLegacyConnectionlessInvitation({
      recordId: faberProofExchangeRecord.id,
      message,
      domain: 'https://a-domain.com',
    })
    await aliceAgent.receiveMessage(requestMessage.toJSON())

    testLogger.test('Alice waits for presentation request from Faber')
    let aliceProofExchangeRecord = await waitForProofExchangeRecordSubject(aliceReplay, {
      state: ProofState.RequestReceived,
    })

    testLogger.test('Alice accepts presentation request from Faber')
    const requestedCredentials = await aliceAgent.proofs.selectCredentialsForRequest({
      proofRecordId: aliceProofExchangeRecord.id,
    })

    await aliceAgent.proofs.acceptRequest({
      proofRecordId: aliceProofExchangeRecord.id,
      proofFormats: { indy: requestedCredentials.proofFormats.indy },
    })

    testLogger.test('Faber waits for presentation from Alice')
    faberProofExchangeRecord = await waitForProofExchangeRecordSubject(faberReplay, {
      threadId: aliceProofExchangeRecord.threadId,
      state: ProofState.PresentationReceived,
    })

    // assert presentation is valid
    expect(faberProofExchangeRecord.isVerified).toBe(true)

    // Faber accepts presentation
    await faberAgent.proofs.acceptPresentation({ proofRecordId: faberProofExchangeRecord.id })

    // Alice waits till it receives presentation ack
    aliceProofExchangeRecord = await waitForProofExchangeRecordSubject(aliceReplay, {
      threadId: aliceProofExchangeRecord.threadId,
      state: ProofState.Done,
    })
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
      autoAcceptProofs: AutoAcceptProof.Always,
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

    const { message, proofRecord: faberProofExchangeRecord } = await faberAgent.proofs.createRequest({
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
      autoAcceptProof: AutoAcceptProof.ContentApproved,
    })

    const { message: requestMessage } = await faberAgent.oob.createLegacyConnectionlessInvitation({
      recordId: faberProofExchangeRecord.id,
      message,
      domain: 'https://a-domain.com',
    })

    await aliceAgent.receiveMessage(requestMessage.toJSON())

    await waitForProofExchangeRecordSubject(aliceReplay, {
      state: ProofState.Done,
      threadId: message.threadId,
    })

    await waitForProofExchangeRecordSubject(faberReplay, {
      state: ProofState.Done,
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
      autoAcceptProofs: AutoAcceptProof.Always,
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

    const { message, proofRecord: faberProofExchangeRecord } = await faberAgent.proofs.createRequest({
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
      autoAcceptProof: AutoAcceptProof.ContentApproved,
    })

    const { message: requestMessage } = await faberAgent.oob.createLegacyConnectionlessInvitation({
      recordId: faberProofExchangeRecord.id,
      message,
      domain: 'https://a-domain.com',
    })

    for (const transport of faberAgent.outboundTransports) {
      await faberAgent.unregisterOutboundTransport(transport)
    }

    await aliceAgent.receiveMessage(requestMessage.toJSON())

    await waitForProofExchangeRecordSubject(aliceReplay, {
      state: ProofState.Done,
      threadId: requestMessage.threadId,
    })

    await waitForProofExchangeRecordSubject(faberReplay, {
      state: ProofState.Done,
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
        autoAcceptMediationRequests: true,
        endpoints: ['rxjs:mediator'],
      },
      getIndySdkModules()
    )

    const mediatorMessages = new Subject<SubjectMessage>()
    const subjectMap = { 'rxjs:mediator': mediatorMessages }

    // Initialize mediator
    const mediatorAgent = new Agent(mediatorAgentOptions)
    mediatorAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    mediatorAgent.registerInboundTransport(new SubjectInboundTransport(mediatorMessages))
    await mediatorAgent.initialize()

    const faberMediationOutOfBandRecord = await mediatorAgent.oob.createInvitation({
      label: 'faber invitation',
      handshakeProtocols: [HandshakeProtocol.Connections],
    })

    const aliceMediationOutOfBandRecord = await mediatorAgent.oob.createInvitation({
      label: 'alice invitation',
      handshakeProtocols: [HandshakeProtocol.Connections],
    })

    const faberAgentOptions = getAgentOptions(
      `Connectionless proofs with mediator Faber-${unique}`,
      {
        mediatorConnectionsInvite: faberMediationOutOfBandRecord.outOfBandInvitation.toUrl({
          domain: 'https://example.com',
        }),
        mediatorPickupStrategy: MediatorPickupStrategy.PickUpV1,
      },
      getLegacyAnonCredsModules({
        autoAcceptProofs: AutoAcceptProof.Always,
      })
    )

    const aliceAgentOptions = getAgentOptions(
      `Connectionless proofs with mediator Alice-${unique}`,
      {
        mediatorConnectionsInvite: aliceMediationOutOfBandRecord.outOfBandInvitation.toUrl({
          domain: 'https://example.com',
        }),
        mediatorPickupStrategy: MediatorPickupStrategy.PickUpV1,
      },
      getLegacyAnonCredsModules({
        autoAcceptProofs: AutoAcceptProof.Always,
      })
    )

    const faberAgent = new Agent(faberAgentOptions)
    faberAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await faberAgent.initialize()

    const aliceAgent = new Agent(aliceAgentOptions)
    aliceAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await aliceAgent.initialize()

    const [faberReplay, aliceReplay] = setupEventReplaySubjects(
      [faberAgent, aliceAgent],
      [CredentialEventTypes.CredentialStateChanged, ProofEventTypes.ProofStateChanged]
    )

    agents = [aliceAgent, faberAgent, mediatorAgent]

    const { credentialDefinition } = await prepareForAnonCredsIssuance(faberAgent, {
      attributeNames: ['name', 'age', 'image_0', 'image_1'],
    })

    const [faberConnection, aliceConnection] = await makeConnection(faberAgent, aliceAgent)
    expect(faberConnection.isReady).toBe(true)
    expect(aliceConnection.isReady).toBe(true)

    await aliceAgent.modules.anoncreds.createLinkSecret({
      linkSecretId: 'default',
      setAsDefault: true,
    })

    await issueLegacyAnonCredsCredential({
      issuerAgent: faberAgent,
      issuerReplay: faberReplay,
      issuerHolderConnectionId: faberConnection.id,
      holderAgent: aliceAgent,
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

    // eslint-disable-next-line prefer-const
    let { message, proofRecord: faberProofExchangeRecord } = await faberAgent.proofs.createRequest({
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
      autoAcceptProof: AutoAcceptProof.ContentApproved,
    })

    const { message: requestMessage } = await faberAgent.oob.createLegacyConnectionlessInvitation({
      recordId: faberProofExchangeRecord.id,
      message,
      domain: 'https://a-domain.com',
    })

    const mediationRecord = await faberAgent.mediationRecipient.findDefaultMediator()
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

    await aliceAgent.receiveMessage(requestMessage.toJSON())

    await waitForProofExchangeRecordSubject(aliceReplay, {
      state: ProofState.Done,
      threadId: requestMessage.threadId,
    })

    await waitForProofExchangeRecordSubject(faberReplay, {
      state: ProofState.Done,
      threadId: requestMessage.threadId,
    })

    await aliceAgent.mediationRecipient.stopMessagePickup()
    await faberAgent.mediationRecipient.stopMessagePickup()
  })
})
