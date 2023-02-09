import type { SubjectMessage } from '../../../../../../../../tests/transport/SubjectInboundTransport'
import type { ProofStateChangedEvent } from '../../../ProofEvents'

import { Subject, ReplaySubject } from 'rxjs'

import { SubjectInboundTransport } from '../../../../../../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../../../../../../tests/transport/SubjectOutboundTransport'
import {
  setupProofsTest,
  waitForProofExchangeRecordSubject,
  getAgentOptions,
  prepareForIssuance,
  makeConnection,
  issueCredential,
} from '../../../../../../tests/helpers'
import testLogger from '../../../../../../tests/logger'
import { Agent } from '../../../../../agent/Agent'
import { Attachment, AttachmentData } from '../../../../../decorators/attachment/Attachment'
import { LinkedAttachment } from '../../../../../utils/LinkedAttachment'
import { uuid } from '../../../../../utils/uuid'
import { HandshakeProtocol } from '../../../../connections'
import { V1CredentialPreview } from '../../../../credentials'
import { MediatorPickupStrategy } from '../../../../routing'
import { ProofEventTypes } from '../../../ProofEvents'
import { ProofAttributeInfo, AttributeFilter, ProofPredicateInfo, PredicateType } from '../../../formats/indy/models'
import { AutoAcceptProof, ProofState } from '../../../models'

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
      'Faber connection-less Proofs v2',
      'Alice connection-less Proofs v2',
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

    let aliceProofExchangeRecordPromise = waitForProofExchangeRecordSubject(aliceReplay, {
      state: ProofState.RequestReceived,
    })

    // eslint-disable-next-line prefer-const
    let { proofRecord: faberProofExchangeRecord, message } = await faberAgent.proofs.createRequest({
      protocolVersion: 'v2',
      proofFormats: {
        indy: {
          name: 'test-proof-request',
          version: '1.0',
          requestedAttributes: attributes,
          requestedPredicates: predicates,
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
    let aliceProofExchangeRecord = await aliceProofExchangeRecordPromise

    testLogger.test('Alice accepts presentation request from Faber')

    const requestedCredentials = await aliceAgent.proofs.selectCredentialsForRequest({
      proofRecordId: aliceProofExchangeRecord.id,
    })

    const faberProofExchangeRecordPromise = waitForProofExchangeRecordSubject(faberReplay, {
      threadId: aliceProofExchangeRecord.threadId,
      state: ProofState.PresentationReceived,
    })

    await aliceAgent.proofs.acceptRequest({
      proofRecordId: aliceProofExchangeRecord.id,
      proofFormats: { indy: requestedCredentials.proofFormats.indy },
    })

    testLogger.test('Faber waits for presentation from Alice')
    faberProofExchangeRecord = await faberProofExchangeRecordPromise

    // assert presentation is valid
    expect(faberProofExchangeRecord.isVerified).toBe(true)

    aliceProofExchangeRecordPromise = waitForProofExchangeRecordSubject(aliceReplay, {
      threadId: aliceProofExchangeRecord.threadId,
      state: ProofState.Done,
    })

    // Faber accepts presentation
    await faberAgent.proofs.acceptPresentation({ proofRecordId: faberProofExchangeRecord.id })

    // Alice waits till it receives presentation ack
    aliceProofExchangeRecord = await aliceProofExchangeRecordPromise
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

    const aliceProofExchangeRecordPromise = waitForProofExchangeRecordSubject(aliceReplay, {
      state: ProofState.Done,
    })

    const faberProofExchangeRecordPromise = waitForProofExchangeRecordSubject(faberReplay, {
      state: ProofState.Done,
    })

    // eslint-disable-next-line prefer-const
    let { message, proofRecord: faberProofExchangeRecord } = await faberAgent.proofs.createRequest({
      protocolVersion: 'v2',
      proofFormats: {
        indy: {
          name: 'test-proof-request',
          version: '1.0',
          requestedAttributes: attributes,
          requestedPredicates: predicates,
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

    await aliceProofExchangeRecordPromise

    await faberProofExchangeRecordPromise
  })

  test('Faber starts with connection-less proof requests to Alice with auto-accept enabled and both agents having a mediator', async () => {
    testLogger.test('Faber sends presentation request to Alice')

    const credentialPreview = V1CredentialPreview.fromRecord({
      name: 'John',
      age: '99',
    })

    const unique = uuid().substring(0, 4)

    const mediatorOptions = getAgentOptions(`Connectionless proofs with mediator Mediator-${unique}`, {
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
    const mediatorAgent = new Agent(mediatorOptions)
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

    const faberOptions = getAgentOptions(`Connectionless proofs with mediator Faber-${unique}`, {
      autoAcceptProofs: AutoAcceptProof.Always,
      mediatorConnectionsInvite: faberMediationOutOfBandRecord.outOfBandInvitation.toUrl({
        domain: 'https://example.com',
      }),
      mediatorPickupStrategy: MediatorPickupStrategy.PickUpV1,
    })

    const aliceOptions = getAgentOptions(`Connectionless proofs with mediator Alice-${unique}`, {
      autoAcceptProofs: AutoAcceptProof.Always,
      mediatorConnectionsInvite: aliceMediationOutOfBandRecord.outOfBandInvitation.toUrl({
        domain: 'https://example.com',
      }),
      mediatorPickupStrategy: MediatorPickupStrategy.PickUpV1,
    })

    const faberAgent = new Agent(faberOptions)
    faberAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    faberAgent.registerInboundTransport(new SubjectInboundTransport(faberMessages))
    await faberAgent.initialize()

    const aliceAgent = new Agent(aliceOptions)
    aliceAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    aliceAgent.registerInboundTransport(new SubjectInboundTransport(aliceMessages))
    await aliceAgent.initialize()

    agents = [aliceAgent, faberAgent, mediatorAgent]

    const { definition } = await prepareForIssuance(faberAgent, ['name', 'age', 'image_0', 'image_1'])

    const [faberConnection, aliceConnection] = await makeConnection(faberAgent, aliceAgent)
    expect(faberConnection.isReady).toBe(true)
    expect(aliceConnection.isReady).toBe(true)

    // issue credential with two linked attachments
    await issueCredential({
      issuerAgent: faberAgent,
      issuerConnectionId: faberConnection.id,
      holderAgent: aliceAgent,
      credentialTemplate: {
        credentialDefinitionId: definition.id,
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

    const aliceProofExchangeRecordPromise = waitForProofExchangeRecordSubject(aliceReplay, {
      state: ProofState.Done,
    })

    const faberProofExchangeRecordPromise = waitForProofExchangeRecordSubject(faberReplay, {
      state: ProofState.Done,
    })

    // eslint-disable-next-line prefer-const
    let { message, proofRecord: faberProofExchangeRecord } = await faberAgent.proofs.createRequest({
      protocolVersion: 'v2',
      proofFormats: {
        indy: {
          name: 'test-proof-request',
          version: '1.0',
          requestedAttributes: attributes,
          requestedPredicates: predicates,
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

    await aliceProofExchangeRecordPromise

    await faberProofExchangeRecordPromise
  })
})
