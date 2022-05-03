import type { SubjectMessage } from '../../../tests/transport/SubjectInboundTransport'
import type { ProofStateChangedEvent } from '../src/modules/proofs'
import type { AcceptPresentationOptions, OutOfBandRequestOptions } from '../src/modules/proofs/models/ModuleOptions'

import { Subject, ReplaySubject } from 'rxjs'

import { SubjectInboundTransport } from '../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../tests/transport/SubjectOutboundTransport'
import { Agent } from '../src/agent/Agent'
import { Attachment, AttachmentData } from '../src/decorators/attachment/Attachment'
import { V1CredentialPreview } from '../src/modules/credentials'
import {
  ProofProtocolVersion,
  PredicateType,
  ProofState,
  ProofAttributeInfo,
  AttributeFilter,
  ProofPredicateInfo,
  AutoAcceptProof,
  ProofEventTypes,
} from '../src/modules/proofs'
import { MediatorPickupStrategy } from '../src/modules/routing'
import { LinkedAttachment } from '../src/utils/LinkedAttachment'
import { uuid } from '../src/utils/uuid'

import {
  getBaseConfig,
  issueCredential,
  makeConnection,
  prepareForIssuance,
  setupProofsTest,
  waitForProofRecordSubject,
} from './helpers'
import testLogger from './logger'

describe('Present Proof', () => {
  let agents: Agent[]

  afterEach(async () => {
    for (const agent of agents) {
      await agent.shutdown()
      await agent.wallet.delete()
    }
  })

  test('Faber starts with connection-less proof requests to Alice', async () => {
    const { aliceAgent, faberAgent, aliceReplay, credDefId, faberReplay } = await setupProofsTest(
      'Faber connection-less Proofs',
      'Alice connection-less Proofs',
      AutoAcceptProof.Never
    )
    agents = [aliceAgent, faberAgent]
    testLogger.test('Faber sends presentation request to Alice')

    const attributes = {
      name: new ProofAttributeInfo({
        name: 'name',
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: credDefId,
          }),
        ],
      }),
    }

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

    const outOfBandRequestOptions: OutOfBandRequestOptions = {
      protocolVersion: ProofProtocolVersion.V1,
      proofFormats: {
        indy: {
          name: 'test-proof-request',
          version: '1.0',
          nonce: '12345678901',
          requestedAttributes: attributes,
          requestedPredicates: predicates,
        },
      },
    }

    // eslint-disable-next-line prefer-const
    let { proofRecord: faberProofRecord, message } = await faberAgent.proofs.createOutOfBandRequest(
      outOfBandRequestOptions
    )

    await aliceAgent.receiveMessage(message.toJSON())

    testLogger.test('Alice waits for presentation request from Faber')
    let aliceProofRecord = await waitForProofRecordSubject(aliceReplay, {
      threadId: faberProofRecord.threadId,
      state: ProofState.RequestReceived,
    })

    testLogger.test('Alice accepts presentation request from Faber')
    const requestedCredentials = await aliceAgent.proofs.autoSelectCredentialsForProofRequest({
      proofRecordId: aliceProofRecord.id,
      config: {
        filterByPresentationPreview: true,
      },
    })

    const acceptPresentationOptions: AcceptPresentationOptions = {
      proofRecordId: aliceProofRecord.id,
      proofFormats: { indy: requestedCredentials.indy },
    }

    await aliceAgent.proofs.acceptRequest(acceptPresentationOptions)

    testLogger.test('Faber waits for presentation from Alice')
    faberProofRecord = await waitForProofRecordSubject(faberReplay, {
      threadId: aliceProofRecord.threadId,
      state: ProofState.PresentationReceived,
    })

    // assert presentation is valid
    expect(faberProofRecord.isVerified).toBe(true)

    // Faber accepts presentation
    await faberAgent.proofs.acceptPresentation(faberProofRecord.id)

    // Alice waits till it receives presentation ack
    aliceProofRecord = await waitForProofRecordSubject(aliceReplay, {
      threadId: aliceProofRecord.threadId,
      state: ProofState.Done,
    })
  })

  test('Faber starts with connection-less proof requests to Alice with auto-accept enabled', async () => {
    testLogger.test('Faber sends presentation request to Alice')

    const { aliceAgent, faberAgent, aliceReplay, credDefId, faberReplay } = await setupProofsTest(
      'Faber connection-less Proofs - Auto Accept',
      'Alice connection-less Proofs - Auto Accept',
      AutoAcceptProof.Always
    )

    agents = [aliceAgent, faberAgent]

    const attributes = {
      name: new ProofAttributeInfo({
        name: 'name',
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: credDefId,
          }),
        ],
      }),
    }

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

    const outOfBandRequestOptions: OutOfBandRequestOptions = {
      protocolVersion: ProofProtocolVersion.V1,
      proofFormats: {
        indy: {
          name: 'test-proof-request',
          version: '1.0',
          nonce: '12345678901',
          requestedAttributes: attributes,
          requestedPredicates: predicates,
        },
      },
      autoAcceptProof: AutoAcceptProof.ContentApproved,
    }

    // eslint-disable-next-line prefer-const
    let { proofRecord: faberProofRecord, message } = await faberAgent.proofs.createOutOfBandRequest(
      outOfBandRequestOptions
    )

    await aliceAgent.receiveMessage(message.toJSON())

    await waitForProofRecordSubject(aliceReplay, {
      threadId: faberProofRecord.threadId,
      state: ProofState.Done,
    })

    await waitForProofRecordSubject(faberReplay, {
      threadId: faberProofRecord.threadId,
      state: ProofState.Done,
    })
  })

  test('Faber starts with connection-less proof requests to Alice with auto-accept enabled and both agents having a mediator', async () => {
    testLogger.test('Faber sends presentation request to Alice')

    const credentialPreview = V1CredentialPreview.fromRecord({
      name: 'John',
      age: '99',
    })

    const unique = uuid().substring(0, 4)

    const mediatorConfig = getBaseConfig(`Connectionless proofs with mediator Mediator-${unique}`, {
      autoAcceptMediationRequests: true,
      endpoints: ['rxjs:mediator'],
    })

    const faberMessages = new Subject<SubjectMessage>()
    const aliceMessages = new Subject<SubjectMessage>()
    const mediatorMessages = new Subject<SubjectMessage>()

    const subjectMap = {
      'rxjs:mediator': mediatorMessages,
    }

    // Initialize mediator
    const mediatorAgent = new Agent(mediatorConfig.config, mediatorConfig.agentDependencies)
    mediatorAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    mediatorAgent.registerInboundTransport(new SubjectInboundTransport(mediatorMessages))
    await mediatorAgent.initialize()

    const faberMediationInvitation = await mediatorAgent.connections.createConnection()
    const aliceMediationInvitation = await mediatorAgent.connections.createConnection()

    const faberConfig = getBaseConfig(`Connectionless proofs with mediator Faber-${unique}`, {
      autoAcceptProofs: AutoAcceptProof.Always,
      mediatorConnectionsInvite: faberMediationInvitation.invitation.toUrl({ domain: 'https://example.com' }),
      mediatorPickupStrategy: MediatorPickupStrategy.PickUpV1,
    })

    const aliceConfig = getBaseConfig(`Connectionless proofs with mediator Alice-${unique}`, {
      autoAcceptProofs: AutoAcceptProof.Always,
      // logger: new TestLogger(LogLevel.test),
      mediatorConnectionsInvite: aliceMediationInvitation.invitation.toUrl({ domain: 'https://example.com' }),
      mediatorPickupStrategy: MediatorPickupStrategy.PickUpV1,
    })

    const faberAgent = new Agent(faberConfig.config, faberConfig.agentDependencies)
    faberAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    faberAgent.registerInboundTransport(new SubjectInboundTransport(faberMessages))
    await faberAgent.initialize()

    const aliceAgent = new Agent(aliceConfig.config, aliceConfig.agentDependencies)
    aliceAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    aliceAgent.registerInboundTransport(new SubjectInboundTransport(aliceMessages))
    await aliceAgent.initialize()

    agents = [aliceAgent, faberAgent, mediatorAgent]

    const { definition } = await prepareForIssuance(faberAgent, ['name', 'age', 'image_0', 'image_1'])

    const [faberConnection, aliceConnection] = await makeConnection(faberAgent, aliceAgent)
    expect(faberConnection.isReady).toBe(true)
    expect(aliceConnection.isReady).toBe(true)

    await issueCredential({
      issuerAgent: faberAgent,
      issuerConnectionId: faberConnection.id,
      holderAgent: aliceAgent,
      credentialTemplate: {
        credentialDefinitionId: definition.id,
        comment: 'some comment about credential',
        preview: credentialPreview,
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
    const faberReplay = new ReplaySubject<ProofStateChangedEvent>()
    const aliceReplay = new ReplaySubject<ProofStateChangedEvent>()

    faberAgent.events.observable<ProofStateChangedEvent>(ProofEventTypes.ProofStateChanged).subscribe(faberReplay)
    aliceAgent.events.observable<ProofStateChangedEvent>(ProofEventTypes.ProofStateChanged).subscribe(aliceReplay)

    const attributes = {
      name: new ProofAttributeInfo({
        name: 'name',
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: definition.id,
          }),
        ],
      }),
    }

    const predicates = {
      age: new ProofPredicateInfo({
        name: 'age',
        predicateType: PredicateType.GreaterThanOrEqualTo,
        predicateValue: 50,
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: definition.id,
          }),
        ],
      }),
    }

    const outOfBandRequestOptions: OutOfBandRequestOptions = {
      protocolVersion: ProofProtocolVersion.V1,
      proofFormats: {
        indy: {
          name: 'test-proof-request',
          version: '1.0',
          nonce: '12345678901',
          requestedAttributes: attributes,
          requestedPredicates: predicates,
        },
      },
      autoAcceptProof: AutoAcceptProof.ContentApproved,
    }
    // eslint-disable-next-line prefer-const
    let { proofRecord: faberProofRecord, message } = await faberAgent.proofs.createOutOfBandRequest(
      outOfBandRequestOptions
    )

    const mediationRecord = await faberAgent.mediationRecipient.findDefaultMediator()
    if (!mediationRecord) {
      throw new Error('Faber agent has no default mediator')
    }

    expect(message).toMatchObject({
      service: {
        recipientKeys: [expect.any(String)],
        routingKeys: mediationRecord.routingKeys,
        serviceEndpoint: mediationRecord.endpoint,
      },
    })

    await aliceAgent.receiveMessage(message.toJSON())

    await waitForProofRecordSubject(aliceReplay, {
      threadId: faberProofRecord.threadId,
      state: ProofState.Done,
    })

    await waitForProofRecordSubject(faberReplay, {
      threadId: faberProofRecord.threadId,
      state: ProofState.Done,
    })
  })
})
