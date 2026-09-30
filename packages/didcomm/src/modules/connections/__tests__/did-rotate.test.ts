import {
  DidDocumentBuilder,
  DidKey,
  didDocumentToNumAlgo2Did,
  getDidPeer4ShortFormForEquivalence,
  getEd25519VerificationKey2018,
  getJsonWebKey2020,
  getX25519KeyAgreementKey2019,
  JsonEncoder,
  Kms,
  NewDidCommV2Service,
  NewDidCommV2ServiceEndpoint,
  PeerDidNumAlgo,
  TypedArrayEncoder,
} from '@credo-ts/core'
import { first, ReplaySubject, timeout } from 'rxjs'

import { Agent } from '../../../../../core/src/agent/Agent'
import { RecordNotFoundError } from '../../../../../core/src/error'
import { createPeerDidDocumentFromServices } from '../../../../../core/src/modules/dids'
import { uuid } from '../../../../../core/src/utils/uuid'
import { setupSubjectTransports } from '../../../../../core/tests'
import {
  firstValueWithStackTrace,
  getAgentOptions,
  makeConnection,
  waitForAgentMessageProcessedEvent,
  waitForBasicMessage,
  waitForDidRotate,
} from '../../../../../core/tests/helpers'
import { DidCommDispatcher } from '../../../DidCommDispatcher'
import { DidCommMessageReceiver } from '../../../DidCommMessageReceiver'
import { DidCommMessageSender } from '../../../DidCommMessageSender'
import { DidCommModuleConfig } from '../../../DidCommModuleConfig'
import { DidCommV2Envelope } from '../../../envelope'
import { getOutboundDidCommMessageContext } from '../../../getDidCommOutboundMessageContext'
import { DidCommEmptyMessage } from '../../../messages'
import { DidCommDocumentService } from '../../../services/DidCommDocumentService'
import {
  type DidCommV2EncryptedMessage,
  DidCommV2EnvelopeService,
  DidCommV2KeyResolver,
  type DidCommV2PlaintextMessage,
} from '../../../v2'
import { computeApu, computeApv } from '../../../v2/apuApv'
import { DidCommBasicMessage, DidCommBasicMessageV2 } from '../../basic-messages'
import { DidCommOutOfBandState } from '../../oob'
import { DidCommForwardV2Message } from '../../routing/protocol/v2/messages'
import {
  DidCommDidRotateAckMessage,
  DidCommDidRotateMessage,
  DidCommDidRotateProblemReportMessage,
  DidCommHangupMessage,
} from '../messages'
import { DidCommConnectionRecord } from '../repository'
import { DidCommConnectionMetadataKeys } from '../repository/DidCommConnectionMetadataTypes'
import { DidCommConnectionService } from '../services'
import { DidCommDidRotateV2Service } from '../services/DidCommDidRotateV2Service'
import {
  createPeerDidForV2OOB,
  findOwnKeyAgreementKey,
  toKeyAgreement,
  toKeyAgreementDidUrl,
} from '../services/helpers'

import { InMemoryDidRegistry } from './InMemoryDidRegistry'

const aliceAgentOptions = getAgentOptions(
  'DID Rotate Alice',
  {
    endpoints: ['rxjs:alice'],
  },
  undefined,
  undefined,
  { requireDidcomm: true }
)
const bobAgentOptions = getAgentOptions(
  'DID Rotate Bob',
  {
    endpoints: ['rxjs:bob'],
  },
  undefined,
  undefined,
  { requireDidcomm: true }
)

// This is the most common flow
describe('Rotation E2E tests', () => {
  let aliceAgent: Agent<(typeof aliceAgentOptions)['modules']>
  let bobAgent: Agent<(typeof bobAgentOptions)['modules']>
  let aliceBobConnection: DidCommConnectionRecord | undefined
  let bobAliceConnection: DidCommConnectionRecord | undefined

  beforeEach(async () => {
    aliceAgent = new Agent(aliceAgentOptions)
    bobAgent = new Agent(bobAgentOptions)

    setupSubjectTransports([aliceAgent, bobAgent])
    await aliceAgent.initialize()
    await bobAgent.initialize()
    ;[aliceBobConnection, bobAliceConnection] = await makeConnection(aliceAgent, bobAgent)
  })

  afterEach(async () => {
    await aliceAgent.shutdown()
    await bobAgent.shutdown()
  })

  describe('Rotation from did:peer:1 to did:peer:4', () => {
    test('Rotate succesfully and send messages to new did afterwards', async () => {
      const oldDid = aliceBobConnection?.did
      expect(bobAliceConnection?.theirDid).toEqual(oldDid)

      // Send message to initial did
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      await bobAgent.didcomm.basicMessages.sendMessage(bobAliceConnection?.id!, 'Hello initial did')

      await waitForBasicMessage(aliceAgent, { content: 'Hello initial did' })

      // Do did rotate
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      const { newDid } = await aliceAgent.didcomm.connections.rotate({ connectionId: aliceBobConnection?.id! })

      // Wait for acknowledge
      await waitForAgentMessageProcessedEvent(aliceAgent, {
        messageType: DidCommDidRotateAckMessage.type.messageTypeUri,
      })

      // Check that new did is taken into account by both parties
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      const newAliceBobConnection = await aliceAgent.didcomm.connections.getById(aliceBobConnection?.id!)
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      const newBobAliceConnection = await bobAgent.didcomm.connections.getById(bobAliceConnection?.id!)

      expect(newAliceBobConnection.did).toEqual(newDid)
      expect(newBobAliceConnection.theirDid).toEqual(newDid)

      // And also they store it into previous dids array
      expect(newAliceBobConnection.previousDids).toContain(oldDid)
      expect(newBobAliceConnection.previousTheirDids).toContain(oldDid)

      // Send message to new did
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      await bobAgent.didcomm.basicMessages.sendMessage(bobAliceConnection?.id!, 'Hello new did')

      await waitForBasicMessage(aliceAgent, { content: 'Hello new did', connectionId: aliceBobConnection?.id })
    })

    test('Rotate succesfully and send messages to previous did afterwards', async () => {
      // Send message to initial did
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      await bobAgent.didcomm.basicMessages.sendMessage(bobAliceConnection?.id!, 'Hello initial did')

      await waitForBasicMessage(aliceAgent, { content: 'Hello initial did' })

      const messageToPreviousDid = await getOutboundDidCommMessageContext(bobAgent.context, {
        message: new DidCommBasicMessage({ content: 'Message to previous did' }),
        connectionRecord: bobAliceConnection,
      })

      // Do did rotate
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      await aliceAgent.didcomm.connections.rotate({ connectionId: aliceBobConnection?.id! })

      // Wait for acknowledge
      await waitForAgentMessageProcessedEvent(aliceAgent, {
        messageType: DidCommDidRotateAckMessage.type.messageTypeUri,
      })

      // Send message to previous did
      await bobAgent.dependencyManager.resolve(DidCommMessageSender).sendMessage(messageToPreviousDid)

      await waitForBasicMessage(aliceAgent, {
        content: 'Message to previous did',
        connectionId: aliceBobConnection?.id,
      })
    })
  })

  describe('Rotation specifying did and routing externally', () => {
    test('Rotate succesfully and send messages to new did afterwards', async () => {
      const oldDid = aliceBobConnection?.did
      expect(bobAliceConnection?.theirDid).toEqual(oldDid)

      // Send message to initial did
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      await bobAgent.didcomm.basicMessages.sendMessage(bobAliceConnection?.id!, 'Hello initial did')

      await waitForBasicMessage(aliceAgent, { content: 'Hello initial did' })

      // Create a new external did

      // Make a common in-memory did registry for both agents
      const didRegistry = new InMemoryDidRegistry()
      aliceAgent.dids.config.addRegistrar(didRegistry)
      aliceAgent.dids.config.addResolver(didRegistry)
      bobAgent.dids.config.addRegistrar(didRegistry)
      bobAgent.dids.config.addResolver(didRegistry)

      const didRouting = await aliceAgent.didcomm.mediationRecipient.getRouting({})
      const did = `did:inmemory:${uuid()}`
      const { didDocument, keys } = createPeerDidDocumentFromServices(
        [
          {
            id: 'didcomm',
            recipientKeys: [didRouting.recipientKey],
            routingKeys: didRouting.routingKeys ?? [],
            serviceEndpoint: didRouting.endpoints[0],
          },
        ],
        true
      )
      didDocument.id = did

      await aliceAgent.dids.create({
        did,
        didDocument,
        options: {
          keys,
        },
      })

      // Do did rotate
      const { newDid } = await aliceAgent.didcomm.connections.rotate({
        // biome-ignore lint/style/noNonNullAssertion: no explanation
        connectionId: aliceBobConnection?.id!,
        toDid: did,
      })

      // Wait for acknowledge
      await waitForAgentMessageProcessedEvent(aliceAgent, {
        messageType: DidCommDidRotateAckMessage.type.messageTypeUri,
      })

      // Check that new did is taken into account by both parties
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      const newAliceBobConnection = await aliceAgent.didcomm.connections.getById(aliceBobConnection?.id!)
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      const newBobAliceConnection = await bobAgent.didcomm.connections.getById(bobAliceConnection?.id!)

      expect(newAliceBobConnection.did).toEqual(newDid)
      expect(newBobAliceConnection.theirDid).toEqual(newDid)

      // And also they store it into previous dids array
      expect(newAliceBobConnection.previousDids).toContain(oldDid)
      expect(newBobAliceConnection.previousTheirDids).toContain(oldDid)

      // Send message to new did
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      await bobAgent.didcomm.basicMessages.sendMessage(bobAliceConnection?.id!, 'Hello new did')

      await waitForBasicMessage(aliceAgent, { content: 'Hello new did', connectionId: aliceBobConnection?.id })
    })

    test('Rotate succesfully and send messages to previous did afterwards', async () => {
      // Send message to initial did
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      await bobAgent.didcomm.basicMessages.sendMessage(bobAliceConnection?.id!, 'Hello initial did')

      await waitForBasicMessage(aliceAgent, { content: 'Hello initial did' })

      const messageToPreviousDid = await getOutboundDidCommMessageContext(bobAgent.context, {
        message: new DidCommBasicMessage({ content: 'Message to previous did' }),
        connectionRecord: bobAliceConnection,
      })

      // Create a new external did

      // Make a common in-memory did registry for both agents
      const didRegistry = new InMemoryDidRegistry()
      aliceAgent.dids.config.addRegistrar(didRegistry)
      aliceAgent.dids.config.addResolver(didRegistry)
      bobAgent.dids.config.addRegistrar(didRegistry)
      bobAgent.dids.config.addResolver(didRegistry)

      const didRouting = await aliceAgent.didcomm.mediationRecipient.getRouting({})
      const did = `did:inmemory:${uuid()}`
      const { didDocument, keys } = createPeerDidDocumentFromServices(
        [
          {
            id: 'didcomm',
            recipientKeys: [didRouting.recipientKey],
            routingKeys: didRouting.routingKeys ?? [],
            serviceEndpoint: didRouting.endpoints[0],
          },
        ],
        true
      )
      didDocument.id = did

      await aliceAgent.dids.create({
        did,
        didDocument,
        options: {
          keys,
        },
      })

      const waitForAllDidRotate = Promise.all([waitForDidRotate(aliceAgent, {}), waitForDidRotate(bobAgent, {})])

      // Do did rotate

      // biome-ignore lint/style/noNonNullAssertion: no explanation
      await aliceAgent.didcomm.connections.rotate({ connectionId: aliceBobConnection?.id!, toDid: did })

      // Wait for acknowledge
      await waitForAgentMessageProcessedEvent(aliceAgent, {
        messageType: DidCommDidRotateAckMessage.type.messageTypeUri,
      })
      const [firstRotate, secondRotate] = await waitForAllDidRotate

      const preRotateDid = aliceBobConnection?.did
      expect(firstRotate).toEqual({
        connectionRecord: expect.any(DidCommConnectionRecord),
        ourDid: {
          from: preRotateDid,
          to: did,
        },
        theirDid: undefined,
      })

      expect(secondRotate).toEqual({
        connectionRecord: expect.any(DidCommConnectionRecord),
        ourDid: undefined,
        theirDid: {
          from: preRotateDid,
          to: did,
        },
      })

      // Send message to previous did
      await bobAgent.dependencyManager.resolve(DidCommMessageSender).sendMessage(messageToPreviousDid)

      await waitForBasicMessage(aliceAgent, {
        content: 'Message to previous did',
        connectionId: aliceBobConnection?.id,
      })
    })

    test('Rotate failed and send messages to previous did afterwards', async () => {
      // Send message to initial did
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      await bobAgent.didcomm.basicMessages.sendMessage(bobAliceConnection?.id!, 'Hello initial did')

      await waitForBasicMessage(aliceAgent, { content: 'Hello initial did' })

      const messageToPreviousDid = await getOutboundDidCommMessageContext(bobAgent.context, {
        message: new DidCommBasicMessage({ content: 'Message to previous did' }),
        connectionRecord: bobAliceConnection,
      })

      // Create a new external did

      // Use custom registry only for Alice agent, in order to force an error on Bob side
      const didRegistry = new InMemoryDidRegistry()
      aliceAgent.dids.config.addRegistrar(didRegistry)
      aliceAgent.dids.config.addResolver(didRegistry)

      const didRouting = await aliceAgent.didcomm.mediationRecipient.getRouting({})
      const did = `did:inmemory:${uuid()}`
      const { didDocument, keys } = createPeerDidDocumentFromServices(
        [
          {
            id: 'didcomm',
            recipientKeys: [didRouting.recipientKey],
            routingKeys: didRouting.routingKeys ?? [],
            serviceEndpoint: didRouting.endpoints[0],
          },
        ],
        true
      )
      didDocument.id = did

      await aliceAgent.dids.create({
        did,
        didDocument,
        options: {
          keys,
        },
      })

      // Do did rotate
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      await aliceAgent.didcomm.connections.rotate({ connectionId: aliceBobConnection?.id!, toDid: did })

      // Wait for a problem report
      await waitForAgentMessageProcessedEvent(aliceAgent, {
        messageType: DidCommDidRotateProblemReportMessage.type.messageTypeUri,
      })

      // Send message to previous did
      await bobAgent.dependencyManager.resolve(DidCommMessageSender).sendMessage(messageToPreviousDid)

      await waitForBasicMessage(aliceAgent, {
        content: 'Message to previous did',
        connectionId: aliceBobConnection?.id,
      })

      // Send message to stored did (should be the previous one)
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      await bobAgent.didcomm.basicMessages.sendMessage(bobAliceConnection?.id!, 'Message after did rotation failure')

      await waitForBasicMessage(aliceAgent, {
        content: 'Message after did rotation failure',
        connectionId: aliceBobConnection?.id,
      })
    })
  })

  describe('Hangup', () => {
    test('Hangup without record deletion', async () => {
      // Send message to initial did
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      await bobAgent.didcomm.basicMessages.sendMessage(bobAliceConnection?.id!, 'Hello initial did')

      await waitForBasicMessage(aliceAgent, { content: 'Hello initial did' })

      // Store an outbound context so we can attempt to send a message even if the connection is terminated.
      // A bit hacky, but may happen in some cases where message retry mechanisms are being used
      const messageBeforeHangup = await getOutboundDidCommMessageContext(bobAgent.context, {
        message: new DidCommBasicMessage({ content: 'Message before hangup' }),
        connectionRecord: bobAliceConnection?.clone(),
      })

      // biome-ignore lint/style/noNonNullAssertion: no explanation
      await aliceAgent.didcomm.connections.hangup({ connectionId: aliceBobConnection?.id! })

      // Wait for hangup
      await waitForAgentMessageProcessedEvent(bobAgent, {
        messageType: DidCommHangupMessage.type.messageTypeUri,
      })

      // If Bob attempts to send a message to Alice after they received the hangup, framework should reject it
      await expect(
        // biome-ignore lint/style/noNonNullAssertion: no explanation
        bobAgent.didcomm.basicMessages.sendMessage(bobAliceConnection?.id!, 'Message after hangup')
      ).rejects.toThrow()

      // If Bob sends a message afterwards, Alice should still be able to receive it
      await bobAgent.dependencyManager.resolve(DidCommMessageSender).sendMessage(messageBeforeHangup)

      await waitForBasicMessage(aliceAgent, {
        content: 'Message before hangup',
        connectionId: aliceBobConnection?.id,
      })
    })

    test('Hangup and delete connection record', async () => {
      // Send message to initial did
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      await bobAgent.didcomm.basicMessages.sendMessage(bobAliceConnection?.id!, 'Hello initial did')

      await waitForBasicMessage(aliceAgent, { content: 'Hello initial did' })

      // Store an outbound context so we can attempt to send a message even if the connection is terminated.
      // A bit hacky, but may happen in some cases where message retry mechanisms are being used
      const messageBeforeHangup = await getOutboundDidCommMessageContext(bobAgent.context, {
        message: new DidCommBasicMessage({ content: 'Message before hangup' }),
        connectionRecord: bobAliceConnection?.clone(),
      })

      // biome-ignore lint/style/noNonNullAssertion: no explanation
      await aliceAgent.didcomm.connections.hangup({ connectionId: aliceBobConnection?.id!, deleteAfterHangup: true })

      // Verify that alice connection has been effectively deleted
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      await expect(aliceAgent.didcomm.connections.getById(aliceBobConnection?.id!)).rejects.toThrow(RecordNotFoundError)

      // Wait for hangup
      await waitForAgentMessageProcessedEvent(bobAgent, {
        messageType: DidCommHangupMessage.type.messageTypeUri,
      })

      // If Bob sends a message afterwards, Alice should not receive it since the connection has been deleted
      await bobAgent.dependencyManager.resolve(DidCommMessageSender).sendMessage(messageBeforeHangup)

      // An error is thrown by Alice agent and, after inspecting all basic messages, it cannot be found
      // TODO: Update as soon as agent sends error events upon reception of messages
      const observable = aliceAgent.events.observable('AgentReceiveMessageError')
      const subject = new ReplaySubject(1)
      observable.pipe(first(), timeout({ first: 10000 })).subscribe(subject)
      await firstValueWithStackTrace(subject)

      const aliceBasicMessages = await aliceAgent.didcomm.basicMessages.findAllByQuery({})
      expect(aliceBasicMessages.find((message) => message.content === 'Message before hangup')).toBeUndefined()
    })

    test('Event emitted after processing hangup', async () => {
      // Send message to initial did
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      await bobAgent.didcomm.basicMessages.sendMessage(bobAliceConnection?.id!, 'Hello initial did')

      await waitForBasicMessage(aliceAgent, { content: 'Hello initial did' })

      // biome-ignore lint/style/noNonNullAssertion: no explanation
      await aliceAgent.didcomm.connections.hangup({ connectionId: aliceBobConnection?.id! })

      // Catch did rotation event message from processHangup()
      const rotationEvent = await waitForDidRotate(bobAgent, {})
      expect(rotationEvent.theirDid?.to).toBeUndefined()
    })
  })
})

const v2AliceAgentOptions = getAgentOptions(
  'V2 End-of-Relationship Alice',
  { didcommVersions: ['v1', 'v2'], endpoints: ['rxjs:v2-alice'] },
  undefined,
  undefined,
  { requireDidcomm: true }
)
const v2BobAgentOptions = getAgentOptions(
  'V2 End-of-Relationship Bob',
  { didcommVersions: ['v1', 'v2'], endpoints: ['rxjs:v2-bob'] },
  undefined,
  undefined,
  { requireDidcomm: true }
)

describe('DIDComm V2 Ending a Relationship E2E tests', () => {
  let aliceAgent: Agent<(typeof v2AliceAgentOptions)['modules']>
  let bobAgent: Agent<(typeof v2BobAgentOptions)['modules']>
  let aliceBobConnection: DidCommConnectionRecord | undefined
  let bobAliceConnection: DidCommConnectionRecord | undefined

  beforeEach(async () => {
    aliceAgent = new Agent(v2AliceAgentOptions)
    bobAgent = new Agent(v2BobAgentOptions)

    setupSubjectTransports([aliceAgent, bobAgent])
    await aliceAgent.initialize()
    await bobAgent.initialize()
    ;[aliceBobConnection, bobAliceConnection] = await makeConnection(aliceAgent, bobAgent, { didCommVersion: 'v2' })
  })

  afterEach(async () => {
    await aliceAgent.shutdown()
    await bobAgent.shutdown()
  })

  test('rotate-to-nothing signal terminates connection on both ends', async () => {
    expect(aliceBobConnection?.didcommVersion).toEqual('v2')
    expect(bobAliceConnection?.didcommVersion).toEqual('v2')

    const aliceDidBeforeHangup = aliceBobConnection?.did

    // biome-ignore lint/style/noNonNullAssertion: no explanation
    await aliceAgent.didcomm.connections.hangup({ connectionId: aliceBobConnection?.id! })

    // Bob receives an empty/1.0/empty message carrying from_prior, processes it,
    // and emits the same rotated event used for v1 hangup.
    const rotationEvent = await waitForDidRotate(bobAgent, {})
    expect(rotationEvent.theirDid?.to).toBeUndefined()

    // biome-ignore lint/style/noNonNullAssertion: no explanation
    const aliceAfter = await aliceAgent.didcomm.connections.findById(aliceBobConnection?.id!)
    expect(aliceAfter?.did).toBeUndefined()
    expect(aliceAfter?.previousDids).toContain(aliceDidBeforeHangup)

    // biome-ignore lint/style/noNonNullAssertion: no explanation
    const bobAfter = await bobAgent.didcomm.connections.findById(bobAliceConnection?.id!)
    expect(bobAfter?.theirDid).toBeUndefined()
    expect(bobAfter?.previousTheirDids).toContain(aliceDidBeforeHangup)
  })

  test('rotate-to-nothing wraps one forward per routing key, each naming the hop it encloses', async () => {
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    const connection = aliceBobConnection!
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    const theirDid = connection.theirDid!
    const agentContext = aliceAgent.context

    const createRoutingKey = async () => {
      const { keyId, publicJwk } = await aliceAgent.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
      return { keyId, publicJwk: Kms.PublicJwk.fromPublicJwk(publicJwk) as Kms.PublicJwk<Kms.Ed25519PublicJwk> }
    }
    const r1 = await createRoutingKey()
    const r2 = await createRoutingKey()

    const [service] = await aliceAgent.dependencyManager
      .resolve(DidCommDocumentService)
      .resolveServicesFromDid(agentContext, theirDid)
    const resolveServices = vi
      .spyOn(DidCommDocumentService.prototype, 'resolveServicesFromDid')
      .mockResolvedValueOnce([{ ...service, routingKeys: [r1.publicJwk, r2.publicJwk] }])

    const transport = aliceAgent.dependencyManager
      .resolve(DidCommModuleConfig)
      .outboundTransports.find((t) => t.supportedSchemes.includes('rxjs'))
    const sentPayloads: unknown[] = []
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    const sendMessage = vi.spyOn(transport!, 'sendMessage').mockImplementation(async ({ payload }) => {
      sentPayloads.push(payload)
    })

    // The module config, and so this transport, is shared with later tests
    try {
      await aliceAgent.dependencyManager
        .resolve(DidCommDidRotateV2Service)
        .sendRotateToNothing(agentContext, connection)
    } finally {
      resolveServices.mockRestore()
      sendMessage.mockRestore()
    }

    const envelopeService = aliceAgent.dependencyManager.resolve(DidCommV2EnvelopeService)
    const openForward = async (message: DidCommV2EncryptedMessage, routingKey: typeof r1) => {
      const matchedKid = message.recipients[0].header.kid
      expect(matchedKid).toEqual(toKeyAgreementDidUrl(routingKey.publicJwk))

      const recipientKey = toKeyAgreement(routingKey.publicJwk)
      recipientKey.keyId = routingKey.keyId
      const { plaintext } = await envelopeService.unpack(agentContext, message, {
        recipientKey: recipientKey as typeof recipientKey & { keyId: string },
        matchedKid,
        resolveSenderKey: async () => null,
      })
      expect(plaintext.type).toEqual(DidCommForwardV2Message.type.messageTypeUri)
      return {
        next: plaintext.body?.next,
        enclosed: plaintext.attachments?.[0].data.json as unknown as DidCommV2EncryptedMessage,
      }
    }

    expect(sentPayloads).toHaveLength(1)
    const outer = await openForward(sentPayloads[0] as DidCommV2EncryptedMessage, r1)
    expect(outer.next).toEqual(new DidKey(r2.publicJwk).did)

    const inner = await openForward(outer.enclosed, r2)
    expect(inner.next).toEqual(getDidPeer4ShortFormForEquivalence(theirDid) ?? theirDid)

    const bobRecipient = await bobAgent.dependencyManager
      .resolve(DidCommV2KeyResolver)
      .resolveRecipientKey(bobAgent.context, inner.enclosed)
    if (!bobRecipient) throw new Error('Bob has no key for the enclosed message')
    const { plaintext } = await bobAgent.dependencyManager
      .resolve(DidCommV2EnvelopeService)
      .unpack(bobAgent.context, inner.enclosed, { ...bobRecipient, resolveSenderKey: async () => null })
    expect(plaintext.to).toEqual([theirDid])
    expect(plaintext.from_prior).toBeDefined()
  })

  test.each([
    'hangup',
    'rotate',
  ] as const)('an anoncrypt %s naming alice in from and skid leaves the connection alone', async (kind) => {
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    const aliceDid = aliceBobConnection!.did!
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    const bobDid = aliceBobConnection!.theirDid!
    const { didDocument, keys } = await aliceAgent.dids.resolveCreatedDidDocumentWithKeys(aliceDid)
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    const aliceSkid = findOwnKeyAgreementKey(didDocument, keys)!.didUrl
    const [bobService] = await aliceAgent.dependencyManager
      .resolve(DidCommDocumentService)
      .resolveServicesFromDid(aliceAgent.context, bobDid)
    const recipientKid = toKeyAgreementDidUrl(bobService.recipientKeys[0])
    const { outOfBandInvitation } = await aliceAgent.didcomm.oob.createInvitation({ didCommVersion: 'v2' })

    const plaintext = {
      id: uuid(),
      type: kind === 'hangup' ? DidCommHangupMessage.type.messageTypeUri : DidCommDidRotateMessage.type.messageTypeUri,
      from: aliceDid,
      to: [bobDid],
      body: kind === 'hangup' ? {} : { to_did: outOfBandInvitation.v2Invitation?.from },
    }

    const kms = aliceAgent.kms
    const apv = computeApv([recipientKid])
    const ephemeralKey = await kms.createKey({ type: { kty: 'OKP', crv: 'X25519' } })
    const protectedHeader = JsonEncoder.toBase64Url({
      typ: 'application/didcomm-encrypted+json',
      alg: 'ECDH-ES+A256KW',
      enc: 'A256CBC-HS512',
      skid: aliceSkid,
      apu: TypedArrayEncoder.toBase64Url(computeApu(aliceSkid)),
      apv: TypedArrayEncoder.toBase64Url(apv),
      epk: { kty: 'OKP', crv: 'X25519', x: (ephemeralKey.publicJwk as Kms.KmsJwkPublicOkp).x },
    })
    const { encrypted, iv, tag, encryptedKey } = await kms.encrypt({
      key: {
        keyAgreement: {
          algorithm: 'ECDH-ES+A256KW',
          keyId: ephemeralKey.keyId,
          externalPublicJwk: toKeyAgreement(bobService.recipientKeys[0]).toJson() as Kms.KmsJwkPublicEcdh,
          apv,
        },
      },
      encryption: { algorithm: 'A256CBC-HS512', aad: TypedArrayEncoder.fromUtf8String(protectedHeader) },
      data: JsonEncoder.toUint8Array(plaintext),
    })
    if (!iv || !tag || !encryptedKey) throw new Error('Expected iv, tag and encrypted key from KMS encrypt')
    const message: DidCommV2EncryptedMessage = {
      protected: protectedHeader,
      recipients: [
        { header: { kid: recipientKid }, encrypted_key: TypedArrayEncoder.toBase64Url(encryptedKey.encrypted) },
      ],
      iv: TypedArrayEncoder.toBase64Url(iv),
      ciphertext: TypedArrayEncoder.toBase64Url(encrypted),
      tag: TypedArrayEncoder.toBase64Url(tag),
    }

    const unpacked = await bobAgent.dependencyManager.resolve(DidCommV2Envelope).unpack(bobAgent.context, message)
    expect(unpacked.plaintextMessage.from).toEqual(aliceDid)
    expect(unpacked.authenticatedSenderDid).toBeUndefined()

    await expect(bobAgent.dependencyManager.resolve(DidCommMessageReceiver).receiveMessage(message)).rejects.toThrow(
      /connection/i
    )

    // biome-ignore lint/style/noNonNullAssertion: no explanation
    const bobAfter = await bobAgent.didcomm.connections.getById(bobAliceConnection!.id)
    expect(bobAfter.theirDid).toEqual(aliceDid)
    expect(bobAfter.previousTheirDids).toEqual(bobAliceConnection?.previousTheirDids)
  })

  test('alice rotates v2 DID; basic message carries from_prior and bob updates theirDid', async () => {
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    const oldAliceDid = aliceBobConnection?.did!

    const didRotateV2 = aliceAgent.dependencyManager.resolve(DidCommDidRotateV2Service)
    const routing = await aliceAgent.didcomm.mediationRecipient.getRouting({})
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    const { newDid } = await didRotateV2.rotateOurDid(aliceAgent.context, aliceBobConnection!, { routing })

    expect(newDid).not.toEqual(oldAliceDid)

    // biome-ignore lint/style/noNonNullAssertion: no explanation
    const aliceAfterRotate = await aliceAgent.didcomm.connections.findById(aliceBobConnection?.id!)
    expect(aliceAfterRotate?.did).toEqual(newDid)
    expect(aliceAfterRotate?.previousDids).toContain(oldAliceDid)
    expect(aliceAfterRotate?.metadata.get(DidCommConnectionMetadataKeys.DidRotateV2)?.priorDid).toEqual(oldAliceDid)

    // biome-ignore lint/style/noNonNullAssertion: no explanation
    await aliceAgent.didcomm.basicMessages.sendMessage(aliceBobConnection?.id!, 'hello rotated')
    await waitForBasicMessage(bobAgent, { content: 'hello rotated' })

    // biome-ignore lint/style/noNonNullAssertion: no explanation
    const bobAfter = await bobAgent.didcomm.connections.findById(bobAliceConnection?.id!)
    expect(bobAfter?.theirDid).toEqual(newDid)
    expect(bobAfter?.previousTheirDids).toContain(oldAliceDid)

    // Bob replies to the new DID; this acknowledges the rotation and Alice clears the pending JWT.
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    await bobAgent.didcomm.basicMessages.sendMessage(bobAliceConnection?.id!, 'ack')
    await waitForBasicMessage(aliceAgent, { content: 'ack' })

    // biome-ignore lint/style/noNonNullAssertion: no explanation
    const aliceCleared = await aliceAgent.didcomm.connections.findById(aliceBobConnection?.id!)
    expect(aliceCleared?.metadata.get(DidCommConnectionMetadataKeys.DidRotateV2)).toBeFalsy()
  })

  test('connections.rotate() mints a new peer DID and delivers from_prior to bob', async () => {
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    const oldAliceDid = aliceBobConnection?.did!

    // biome-ignore lint/style/noNonNullAssertion: no explanation
    const { newDid } = await aliceAgent.didcomm.connections.rotate({ connectionId: aliceBobConnection?.id! })

    expect(newDid).not.toEqual(oldAliceDid)
    expect(newDid.startsWith('did:peer:')).toBe(true)

    // biome-ignore lint/style/noNonNullAssertion: no explanation
    const aliceAfter = await aliceAgent.didcomm.connections.findById(aliceBobConnection?.id!)
    expect(aliceAfter?.did).toEqual(newDid)
    expect(aliceAfter?.previousDids).toContain(oldAliceDid)

    // biome-ignore lint/style/noNonNullAssertion: no explanation
    await aliceAgent.didcomm.basicMessages.sendMessage(aliceBobConnection?.id!, 'after rotate')
    await waitForBasicMessage(bobAgent, { content: 'after rotate' })

    // biome-ignore lint/style/noNonNullAssertion: no explanation
    const bobAfter = await bobAgent.didcomm.connections.findById(bobAliceConnection?.id!)
    expect(bobAfter?.theirDid).toEqual(newDid)
    expect(bobAfter?.previousTheirDids).toContain(oldAliceDid)
  })

  describe('from_prior handling', () => {
    const outboundTransport = (agent: Agent) => {
      const transport = agent.dependencyManager
        .resolve(DidCommModuleConfig)
        .outboundTransports.find((t) => t.supportedSchemes.includes('rxjs'))
      if (!transport) throw new Error('No rxjs outbound transport')
      return transport
    }

    const captureFromAlice = async (send: () => Promise<unknown>): Promise<DidCommV2EncryptedMessage> => {
      const payloads: unknown[] = []
      const sendMessage = vi
        .spyOn(outboundTransport(aliceAgent), 'sendMessage')
        .mockImplementation(async ({ payload }) => {
          payloads.push(payload)
        })
      try {
        await send()
      } finally {
        sendMessage.mockRestore()
      }
      expect(payloads).toHaveLength(1)
      return payloads[0] as DidCommV2EncryptedMessage
    }

    const sendBasicMessageAs = async (did: string, fromPriorJwt: string, content: string) => {
      const connectionService = aliceAgent.dependencyManager.resolve(DidCommConnectionService)
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      const connection = await connectionService.getById(aliceAgent.context, aliceBobConnection!.id)
      connection.did = did
      connection.metadata.set(DidCommConnectionMetadataKeys.DidRotateV2, { fromPriorJwt, priorDid: did, newDid: did })
      await connectionService.update(aliceAgent.context, connection)
      return captureFromAlice(() => aliceAgent.didcomm.basicMessages.sendMessage(connection.id, content))
    }

    const receiveOnBob = (message: DidCommV2EncryptedMessage) =>
      bobAgent.dependencyManager.resolve(DidCommMessageReceiver).receiveMessage(message)

    const bobRecipient = async () => {
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      const did = aliceBobConnection!.theirDid!
      const [bobService] = await aliceAgent.dependencyManager
        .resolve(DidCommDocumentService)
        .resolveServicesFromDid(aliceAgent.context, did)
      return {
        did,
        recipientKey: toKeyAgreement(bobService.recipientKeys[0]),
        recipientKid: toKeyAgreementDidUrl(bobService.recipientKeys[0]),
      }
    }

    const anoncryptToBob = async (
      plaintext: Pick<DidCommV2PlaintextMessage, 'type' | 'from_prior' | 'created_time' | 'body'>
    ) => {
      const { did, recipientKey, recipientKid } = await bobRecipient()
      return aliceAgent.dependencyManager.resolve(DidCommV2EnvelopeService).packAnoncrypt(
        aliceAgent.context,
        { id: uuid(), to: [did], ...plaintext },
        {
          recipientKey,
          recipientKid,
          contentEncryptionAlgorithm:
            aliceAgent.dependencyManager.resolve(DidCommModuleConfig).v2DefaultAnoncryptContentEncryption,
        }
      )
    }

    const bobContents = async () => (await bobAgent.didcomm.basicMessages.findAllByQuery({})).map((r) => r.content)

    // biome-ignore lint/style/noNonNullAssertion: no explanation
    const getBobConnection = () => bobAgent.didcomm.connections.getById(bobAliceConnection!.id)

    const createAliceDid = async () =>
      (await createPeerDidForV2OOB(aliceAgent.context, await aliceAgent.didcomm.mediationRecipient.getRouting({}))).did

    const aliceRotateService = () => aliceAgent.dependencyManager.resolve(DidCommDidRotateV2Service)

    const rotateAlice = async (toDid?: string) => {
      const rotated = waitForDidRotate(bobAgent, {})
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      const { newDid } = await aliceAgent.didcomm.connections.rotate({ connectionId: aliceBobConnection!.id, toDid })
      await rotated
      return newDid
    }

    test('a retransmitted rotation is not verified again and the message is still processed', async () => {
      const newDid = await rotateAlice()
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      const aliceConnection = await aliceAgent.didcomm.connections.getById(aliceBobConnection!.id)
      expect(aliceRotateService().getPendingFromPrior(aliceConnection)).toBeDefined()

      const verifyFromPrior = vi.spyOn(bobAgent.dependencyManager.resolve(DidCommDidRotateV2Service), 'verifyFromPrior')
      try {
        await aliceAgent.didcomm.basicMessages.sendMessage(aliceConnection.id, 'retransmitted rotation')
        await waitForBasicMessage(bobAgent, { content: 'retransmitted rotation' })
        expect(verifyFromPrior).not.toHaveBeenCalled()
      } finally {
        verifyFromPrior.mockRestore()
      }

      expect((await getBobConnection()).theirDid).toEqual(newDid)
    })

    test('an anoncrypt termination is applied and processed once and a retransmission is dropped', async () => {
      const termination = await captureFromAlice(() =>
        // biome-ignore lint/style/noNonNullAssertion: no explanation
        aliceAgent.didcomm.connections.hangup({ connectionId: aliceBobConnection!.id })
      )

      const dispatch = vi.spyOn(bobAgent.dependencyManager.resolve(DidCommDispatcher), 'dispatch')
      try {
        await receiveOnBob(termination)
        const terminated = await getBobConnection()
        expect(terminated.theirDid).toBeUndefined()
        expect(dispatch).toHaveBeenCalledTimes(1)

        await receiveOnBob(termination)
        expect(dispatch).toHaveBeenCalledTimes(1)
        expect((await getBobConnection()).previousTheirDids).toEqual(terminated.previousTheirDids)
      } finally {
        dispatch.mockRestore()
      }
    })

    test.each([
      { case: 'the acknowledged rotation JWT', signAgain: false },
      { case: 'a new rotation JWT signed with the superseded key', signAgain: true },
    ])('an anoncrypt message carrying $case is not processed on the connection', async ({ signAgain }) => {
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      const oldAliceDid = aliceBobConnection!.did!
      const newDid = await rotateAlice()
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      const aliceConnection = await aliceAgent.didcomm.connections.getById(aliceBobConnection!.id)
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      const rotationJwt = aliceRotateService().getPendingFromPrior(aliceConnection)!
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      await bobAgent.didcomm.basicMessages.sendMessage(bobAliceConnection!.id, 'ack')
      await waitForBasicMessage(aliceAgent, { content: 'ack' })

      const fromPrior = signAgain
        ? await aliceRotateService().createFromPriorForRotation(aliceAgent.context, oldAliceDid, newDid)
        : rotationJwt
      const message = await anoncryptToBob({
        type: DidCommBasicMessageV2.type.messageTypeUri,
        from_prior: fromPrior,
        created_time: Math.floor(Date.now() / 1000),
        body: { content: 'injected' },
      })

      const dispatch = vi.spyOn(bobAgent.dependencyManager.resolve(DidCommDispatcher), 'dispatch')
      try {
        await receiveOnBob(message)
        expect(dispatch).not.toHaveBeenCalled()
      } finally {
        dispatch.mockRestore()
      }

      const bobConnection = await getBobConnection()
      expect(
        await bobAgent.didcomm.basicMessages.findAllByQuery({ connectionId: bobConnection.id })
      ).not.toContainEqual(expect.objectContaining({ content: 'injected' }))
      expect(bobConnection.theirDid).toEqual(newDid)
    })

    test('an unsigned copy of an applied rotation sent over anoncrypt is not processed on the connection', async () => {
      await rotateAlice()
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      const aliceConnection = await aliceAgent.didcomm.connections.getById(aliceBobConnection!.id)
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      const [header, payload] = aliceRotateService().getPendingFromPrior(aliceConnection)!.split('.')
      const forged = `${header}.${payload}.${TypedArrayEncoder.toBase64Url(new Uint8Array(64))}`

      const message = await anoncryptToBob({
        type: DidCommEmptyMessage.type.messageTypeUri,
        from_prior: forged,
        body: {},
      })
      const before = await getBobConnection()

      const dispatch = vi.spyOn(bobAgent.dependencyManager.resolve(DidCommDispatcher), 'dispatch')
      try {
        await expect(receiveOnBob(message)).rejects.toThrow(/from_prior/)
        expect(dispatch).not.toHaveBeenCalled()
      } finally {
        dispatch.mockRestore()
      }

      const after = await getBobConnection()
      expect(after.theirDid).toEqual(before.theirDid)
      expect(after.previousTheirDids).toEqual(before.previousTheirDids)
    })

    test('a termination sent over authcrypt from the current peer DID is applied and the message is processed', async () => {
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      const aliceDid = aliceBobConnection!.did!
      const termination = await aliceRotateService().createFromPriorForTermination(aliceAgent.context, aliceDid)

      await receiveOnBob(await sendBasicMessageAs(aliceDid, termination, 'goodbye'))

      const bobAfter = await getBobConnection()
      expect(bobAfter.theirDid).toBeUndefined()
      expect(bobAfter.previousTheirDids).toContain(aliceDid)
      expect(await bobContents()).toContain('goodbye')
    })

    test('a from_prior with a non-string sub drops the message', async () => {
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      const aliceDid = aliceBobConnection!.did!
      const jwt = await aliceRotateService().createFromPriorForRotation(
        aliceAgent.context,
        aliceDid,
        null as unknown as string
      )
      expect(JsonEncoder.fromBase64Url(jwt.split('.')[1]).sub).toBeNull()

      await expect(receiveOnBob(await sendBasicMessageAs(aliceDid, jwt, 'null sub'))).rejects.toThrow(/sub/)

      expect((await getBobConnection()).theirDid).toEqual(aliceDid)
      expect(await bobContents()).not.toContain('null sub')
    })

    test('a from_prior with a bad signature drops the message and changes nothing', async () => {
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      const aliceDid = aliceBobConnection!.did!
      const termination = await aliceRotateService().createFromPriorForTermination(aliceAgent.context, aliceDid)
      const rotation = await aliceRotateService().createFromPriorForRotation(
        aliceAgent.context,
        aliceDid,
        await createAliceDid()
      )
      const [header, payload] = termination.split('.')
      const badSignature = `${header}.${payload}.${rotation.split('.')[2]}`

      const message = await sendBasicMessageAs(aliceDid, badSignature, 'bad signature')
      await expect(receiveOnBob(message)).rejects.toThrow(/from_prior/)

      const bobAfter = await getBobConnection()
      expect(bobAfter.theirDid).toEqual(aliceDid)
      expect(bobAfter.previousTheirDids).toEqual([])
      expect(await bobContents()).not.toContain('bad signature')
    })

    test('a from_prior issued by a DID other than the peer changes nothing', async () => {
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      const aliceDid = aliceBobConnection!.did!
      const foreignDid = await createAliceDid()
      const jwt = await aliceRotateService().createFromPriorForTermination(aliceAgent.context, foreignDid)
      const verified = await bobAgent.dependencyManager
        .resolve(DidCommDidRotateV2Service)
        .verifyFromPrior(bobAgent.context, jwt)
      expect(verified.iss).toEqual(foreignDid)

      await receiveOnBob(await sendBasicMessageAs(aliceDid, jwt, 'foreign issuer'))

      expect((await getBobConnection()).theirDid).toEqual(aliceDid)
      expect(await bobContents()).toContain('foreign issuer')
    })

    test('a from_prior signed by a superseded peer DID does not move the connection', async () => {
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      const oldAliceDid = aliceBobConnection!.did!
      const newDid = await rotateAlice()

      const otherDid = await createAliceDid()
      const jwt = await aliceRotateService().createFromPriorForRotation(aliceAgent.context, oldAliceDid, otherDid)
      await receiveOnBob(await sendBasicMessageAs(otherDid, jwt, 'rollback'))

      expect((await getBobConnection()).theirDid).toEqual(newDid)
      expect(await bobContents()).not.toContain('rollback')
    })

    test('a from_prior does not revive a terminated connection', async () => {
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      const aliceDid = aliceBobConnection!.did!
      const terminated = waitForDidRotate(bobAgent, {})
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      await aliceAgent.didcomm.connections.hangup({ connectionId: aliceBobConnection!.id })
      await terminated

      const otherDid = await createAliceDid()
      const jwt = await aliceRotateService().createFromPriorForRotation(aliceAgent.context, aliceDid, otherDid)
      await receiveOnBob(await sendBasicMessageAs(otherDid, jwt, 'revive'))

      expect((await getBobConnection()).theirDid).toBeUndefined()
      expect(await bobContents()).not.toContain('revive')
    })

    test('a message sent from the old DID that arrives after the rotation is ignored', async () => {
      const stale = await captureFromAlice(() =>
        // biome-ignore lint/style/noNonNullAssertion: no explanation
        aliceAgent.didcomm.basicMessages.sendMessage(aliceBobConnection!.id, 'sent before rotation')
      )
      const newDid = await rotateAlice()

      await receiveOnBob(stale)

      expect((await getBobConnection()).theirDid).toEqual(newDid)
      expect(await bobContents()).not.toContain('sent before rotation')
    })

    test('a message authcrypted by another DID with the key of a superseded peer DID is ignored', async () => {
      const supersededDid = await rotateAlice()
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      await bobAgent.didcomm.basicMessages.sendMessage(bobAliceConnection!.id, 'ack first')
      await waitForBasicMessage(aliceAgent, { content: 'ack first' })
      await rotateAlice()
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      await bobAgent.didcomm.basicMessages.sendMessage(bobAliceConnection!.id, 'ack second')
      await waitForBasicMessage(aliceAgent, { content: 'ack second' })
      expect((await getBobConnection()).previousTheirDids).toContain(supersededDid)

      const { didDocument, keys } = await aliceAgent.dids.resolveCreatedDidDocumentWithKeys(supersededDid)
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      const supersededKey = findOwnKeyAgreementKey(didDocument, keys)!.publicJwk
      const otherDid = didDocumentToNumAlgo2Did(
        new DidDocumentBuilder('')
          .addKeyAgreement(
            getX25519KeyAgreementKey2019({
              id: '#key-1',
              publicJwk: supersededKey as Kms.PublicJwk<Kms.X25519PublicJwk>,
              controller: '#id',
            })
          )
          .build()
      )
      const { did: bobDid, recipientKey, recipientKid } = await bobRecipient()
      const message = await aliceAgent.dependencyManager.resolve(DidCommV2EnvelopeService).pack(
        aliceAgent.context,
        {
          id: uuid(),
          type: DidCommBasicMessageV2.type.messageTypeUri,
          from: otherDid,
          to: [bobDid],
          created_time: Math.floor(Date.now() / 1000),
          body: { content: 'sent with a superseded key' },
        },
        { recipientKey, recipientKid, senderKey: supersededKey, senderKeySkid: `${otherDid}#key-1` }
      )

      const dispatch = vi.spyOn(bobAgent.dependencyManager.resolve(DidCommDispatcher), 'dispatch')
      try {
        await receiveOnBob(message)
        expect(dispatch).not.toHaveBeenCalled()
      } finally {
        dispatch.mockRestore()
      }
      expect(await bobContents()).not.toContain('sent with a superseded key')
    })

    test('rotating away from a DID whose first authentication key is P-256 reaches the peer', async () => {
      const authKey = await aliceAgent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
      const agreementKey = await aliceAgent.kms.createKey({ type: { kty: 'OKP', crv: 'X25519' } })
      // The message sender still needs an Ed25519 authentication key
      const senderKey = await aliceAgent.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
      const didDocument = new DidDocumentBuilder('')
        .addAuthentication(
          getJsonWebKey2020({
            did: '#id',
            publicJwk: Kms.PublicJwk.fromPublicJwk(authKey.publicJwk),
            verificationMethodId: '#key-1',
          })
        )
        .addAuthentication(
          getEd25519VerificationKey2018({
            id: '#key-3',
            publicJwk: Kms.PublicJwk.fromPublicJwk(senderKey.publicJwk) as Kms.PublicJwk<Kms.Ed25519PublicJwk>,
            controller: '#id',
          })
        )
        .addKeyAgreement(
          getX25519KeyAgreementKey2019({
            id: '#key-2',
            publicJwk: Kms.PublicJwk.fromPublicJwk(agreementKey.publicJwk) as Kms.PublicJwk<Kms.X25519PublicJwk>,
            controller: '#id',
          })
        )
        .addService(
          new NewDidCommV2Service({
            id: '#didcommmessaging-0',
            serviceEndpoint: new NewDidCommV2ServiceEndpoint({ uri: 'rxjs:v2-alice', accept: ['didcomm/v2'] }),
          })
        )
        .build()
      const { didState } = await aliceAgent.dids.create({
        method: 'peer',
        didDocument,
        options: {
          numAlgo: PeerDidNumAlgo.ShortFormAndLongForm,
          keys: [
            { didDocumentRelativeKeyId: '#key-1', kmsKeyId: authKey.keyId },
            { didDocumentRelativeKeyId: '#key-2', kmsKeyId: agreementKey.keyId },
            { didDocumentRelativeKeyId: '#key-3', kmsKeyId: senderKey.keyId },
          ],
        },
      })
      if (!didState.did) throw new Error('P-256 DID was not created')

      const p256Did = await rotateAlice(didState.did)
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      await bobAgent.didcomm.basicMessages.sendMessage(bobAliceConnection!.id, 'reached p-256 did')
      await waitForBasicMessage(aliceAgent, { content: 'reached p-256 did' })

      const newDid = await rotateAlice()

      // biome-ignore lint/style/noNonNullAssertion: no explanation
      const aliceConnection = await aliceAgent.didcomm.connections.getById(aliceBobConnection!.id)
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      const fromPrior = aliceRotateService().getPendingFromPrior(aliceConnection)!
      expect(JsonEncoder.fromBase64Url(fromPrior.split('.')[0]).alg).toEqual('ES256')

      const bobAfter = await getBobConnection()
      expect(bobAfter.theirDid).toEqual(newDid)
      expect(bobAfter.previousTheirDids).toContain(p256Did)
    })
  })
})

const v2InviterAgentOptions = getAgentOptions(
  'V2 Multi-Use Inviter',
  {
    didcommVersions: ['v1', 'v2'],
    endpoints: ['rxjs:v2-inviter'],
    connections: { autoAcceptConnections: true, autoCreateConnectionOnFirstMessage: true },
  },
  undefined,
  undefined,
  { requireDidcomm: true }
)
const v2AccepterAgentOptions = getAgentOptions(
  'V2 Multi-Use Accepter',
  {
    didcommVersions: ['v1', 'v2'],
    endpoints: ['rxjs:v2-accepter'],
    connections: { autoAcceptConnections: true, autoCreateConnectionOnFirstMessage: true },
  },
  undefined,
  undefined,
  { requireDidcomm: true }
)
const v2AccepterTwoAgentOptions = getAgentOptions(
  'V2 Multi-Use Accepter Two',
  {
    didcommVersions: ['v1', 'v2'],
    endpoints: ['rxjs:v2-accepter-two'],
    connections: { autoAcceptConnections: true, autoCreateConnectionOnFirstMessage: true },
  },
  undefined,
  undefined,
  { requireDidcomm: true }
)

describe('DIDComm V2 multi-use OOB inviter-side rotation', () => {
  let inviter: Agent<(typeof v2InviterAgentOptions)['modules']>
  let accepter: Agent<(typeof v2AccepterAgentOptions)['modules']>
  let accepterTwo: Agent<(typeof v2AccepterTwoAgentOptions)['modules']>

  beforeEach(async () => {
    inviter = new Agent(v2InviterAgentOptions)
    accepter = new Agent(v2AccepterAgentOptions)
    accepterTwo = new Agent(v2AccepterTwoAgentOptions)
    setupSubjectTransports([inviter, accepter, accepterTwo])
    await inviter.initialize()
    await accepter.initialize()
    await accepterTwo.initialize()
  })

  afterEach(async () => {
    await inviter.shutdown()
    await accepter.shutdown()
    await accepterTwo.shutdown()
  })

  test('inviter rotates its DID per accepter; from_prior announces the rotation', async () => {
    const invitation = await inviter.didcomm.oob.createInvitation({
      didCommVersion: 'v2',
      multiUseInvitation: true,
    })
    const invitationDid = invitation.outOfBandInvitation.v2Invitation?.from
    expect(invitationDid).toBeDefined()

    const { connectionRecord: accepterConnection } = await accepter.didcomm.oob.receiveInvitation(
      invitation.outOfBandInvitation,
      { label: '' }
    )
    expect(accepterConnection?.theirDid).toEqual(invitationDid)

    // First inbound from accepter to invitation DID triggers inviter-side auto-create + rotation.
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    await accepter.didcomm.basicMessages.sendMessage(accepterConnection?.id!, 'hi from accepter')
    await waitForBasicMessage(inviter, { content: 'hi from accepter' })

    const inviterConnections = await inviter.didcomm.connections.findAllByOutOfBandId(invitation.id)
    expect(inviterConnections.length).toBeGreaterThan(0)
    const inviterConnection = inviterConnections[0]

    expect(inviterConnection.did).not.toEqual(invitationDid)
    expect(inviterConnection.previousDids).toContain(invitationDid)
    const pending = inviterConnection.metadata.get(DidCommConnectionMetadataKeys.DidRotateV2)
    expect(pending?.priorDid).toEqual(invitationDid)
    expect(pending?.newDid).toEqual(inviterConnection.did)
    expect(pending?.fromPriorJwt).toBeDefined()

    await inviter.didcomm.basicMessages.sendMessage(inviterConnection.id, 'hi from inviter (rotated)')
    await waitForBasicMessage(accepter, { content: 'hi from inviter (rotated)' })

    // biome-ignore lint/style/noNonNullAssertion: no explanation
    const accepterAfter = await accepter.didcomm.connections.findById(accepterConnection?.id!)
    expect(accepterAfter?.theirDid).toEqual(inviterConnection.did)
    expect(accepterAfter?.previousTheirDids).toContain(invitationDid)

    // Accepter now replies to the inviter's new DID; inviter clears pending rotation.
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    await accepter.didcomm.basicMessages.sendMessage(accepterConnection?.id!, 'ack')
    await waitForBasicMessage(inviter, { content: 'ack' })

    const inviterCleared = await inviter.didcomm.connections.findById(inviterConnection.id)
    expect(inviterCleared?.metadata.get(DidCommConnectionMetadataKeys.DidRotateV2)).toBeFalsy()
  })

  test('two accepters on the same multi-use invitation get distinct inviter DIDs (no correlator)', async () => {
    const invitation = await inviter.didcomm.oob.createInvitation({
      didCommVersion: 'v2',
      multiUseInvitation: true,
    })
    const invitationDid = invitation.outOfBandInvitation.v2Invitation?.from
    expect(invitationDid).toBeDefined()

    const { connectionRecord: firstAccepterConnection } = await accepter.didcomm.oob.receiveInvitation(
      invitation.outOfBandInvitation,
      { label: '' }
    )
    expect(firstAccepterConnection?.theirDid).toEqual(invitationDid)
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    await accepter.didcomm.basicMessages.sendMessage(firstAccepterConnection?.id!, 'first hello')
    await waitForBasicMessage(inviter, { content: 'first hello' })

    const { connectionRecord: secondAccepterConnection } = await accepterTwo.didcomm.oob.receiveInvitation(
      invitation.outOfBandInvitation,
      { label: '' }
    )
    expect(secondAccepterConnection?.theirDid).toEqual(invitationDid)
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    await accepterTwo.didcomm.basicMessages.sendMessage(secondAccepterConnection?.id!, 'second hello')
    await waitForBasicMessage(inviter, { content: 'second hello' })

    const inviterConnections = await inviter.didcomm.connections.findAllByOutOfBandId(invitation.id)
    expect(inviterConnections.length).toEqual(2)

    // biome-ignore lint/style/noNonNullAssertion: no explanation
    const firstAccepterDid = (await accepter.didcomm.connections.findById(firstAccepterConnection?.id!))?.did
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    const secondAccepterDid = (await accepterTwo.didcomm.connections.findById(secondAccepterConnection?.id!))?.did
    const inviterToFirst = inviterConnections.find((c) => c.theirDid === firstAccepterDid)
    const inviterToSecond = inviterConnections.find((c) => c.theirDid === secondAccepterDid)
    expect(inviterToFirst).toBeDefined()
    expect(inviterToSecond).toBeDefined()
    if (!inviterToFirst || !inviterToSecond) throw new Error('inviter connections not matched to accepters')

    // Neither inviter-side connection reuses the invitation DID, and the two
    // connections have distinct per-pair DIDs so accepters cannot be correlated through it.
    expect(inviterToFirst.did).not.toEqual(invitationDid)
    expect(inviterToSecond.did).not.toEqual(invitationDid)
    expect(inviterToFirst.did).not.toEqual(inviterToSecond.did)

    expect(inviterToFirst.previousDids).toContain(invitationDid)
    expect(inviterToSecond.previousDids).toContain(invitationDid)

    const firstPending = inviterToFirst.metadata.get(DidCommConnectionMetadataKeys.DidRotateV2)
    const secondPending = inviterToSecond.metadata.get(DidCommConnectionMetadataKeys.DidRotateV2)
    expect(firstPending?.priorDid).toEqual(invitationDid)
    expect(secondPending?.priorDid).toEqual(invitationDid)
    expect(firstPending?.newDid).toEqual(inviterToFirst.did)
    expect(secondPending?.newDid).toEqual(inviterToSecond.did)
    expect(firstPending?.fromPriorJwt).toBeDefined()
    expect(secondPending?.fromPriorJwt).toBeDefined()
    expect(firstPending?.fromPriorJwt).not.toEqual(secondPending?.fromPriorJwt)

    // Each accepter receives the inviter's own per-pair rotated DID, not the invitation DID nor the
    // other accepter's per-pair DID.
    await inviter.didcomm.basicMessages.sendMessage(inviterToFirst.id, 'hello first (rotated)')
    await inviter.didcomm.basicMessages.sendMessage(inviterToSecond.id, 'hello second (rotated)')
    await waitForBasicMessage(accepter, { content: 'hello first (rotated)' })
    await waitForBasicMessage(accepterTwo, { content: 'hello second (rotated)' })

    // biome-ignore lint/style/noNonNullAssertion: no explanation
    const accepterAfter = await accepter.didcomm.connections.findById(firstAccepterConnection?.id!)
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    const accepterTwoAfter = await accepterTwo.didcomm.connections.findById(secondAccepterConnection?.id!)
    expect(accepterAfter?.theirDid).toEqual(inviterToFirst.did)
    expect(accepterTwoAfter?.theirDid).toEqual(inviterToSecond.did)
    expect(accepterAfter?.theirDid).not.toEqual(accepterTwoAfter?.theirDid)
  })

  test('an anoncrypt first message to a v2 invitation DID creates no connection', async () => {
    const invitation = await inviter.didcomm.oob.createInvitation({ didCommVersion: 'v2' })
    const invitationDid = invitation.outOfBandInvitation.v2Invitation?.from as string
    const { connectionRecord } = await accepter.didcomm.oob.receiveInvitation(invitation.outOfBandInvitation, {
      label: '',
    })
    const [invitationService] = await accepter.dependencyManager
      .resolve(DidCommDocumentService)
      .resolveServicesFromDid(accepter.context, invitationDid)
    const message = await accepter.dependencyManager.resolve(DidCommV2EnvelopeService).packAnoncrypt(
      accepter.context,
      {
        id: uuid(),
        type: DidCommEmptyMessage.type.messageTypeUri,
        // biome-ignore lint/style/noNonNullAssertion: no explanation
        from: connectionRecord!.did!,
        to: [invitationDid],
        body: {},
      },
      {
        recipientKey: toKeyAgreement(invitationService.recipientKeys[0]),
        recipientKid: toKeyAgreementDidUrl(invitationService.recipientKeys[0]),
        contentEncryptionAlgorithm:
          accepter.dependencyManager.resolve(DidCommModuleConfig).v2DefaultAnoncryptContentEncryption,
      }
    )

    await inviter.dependencyManager.resolve(DidCommMessageReceiver).receiveMessage(message)

    expect(await inviter.didcomm.connections.getAll()).toHaveLength(0)
    expect((await inviter.didcomm.oob.getById(invitation.id)).state).toEqual(DidCommOutOfBandState.AwaitResponse)
  })

  test('a rotation from_prior replayed by another accepter over anoncrypt changes nothing', async () => {
    const invitation = await inviter.didcomm.oob.createInvitation({
      didCommVersion: 'v2',
      multiUseInvitation: true,
    })
    const invitationDid = invitation.outOfBandInvitation.v2Invitation?.from

    const { connectionRecord: attackerConnection } = await accepter.didcomm.oob.receiveInvitation(
      invitation.outOfBandInvitation,
      { label: '' }
    )
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    await accepter.didcomm.basicMessages.sendMessage(attackerConnection!.id, 'hi from attacker')
    await waitForBasicMessage(inviter, { content: 'hi from attacker' })
    const [inviterConnection] = await inviter.didcomm.connections.findAllByOutOfBandId(invitation.id)
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    const { fromPriorJwt } = inviterConnection.metadata.get(DidCommConnectionMetadataKeys.DidRotateV2)!

    const { connectionRecord: victimConnection } = await accepterTwo.didcomm.oob.receiveInvitation(
      invitation.outOfBandInvitation,
      { label: '' }
    )
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    const victimDid = victimConnection!.did!
    const [victimService] = await accepter.dependencyManager
      .resolve(DidCommDocumentService)
      .resolveServicesFromDid(accepter.context, victimDid)
    const replay = await accepter.dependencyManager.resolve(DidCommV2EnvelopeService).packAnoncrypt(
      accepter.context,
      {
        id: uuid(),
        type: DidCommEmptyMessage.type.messageTypeUri,
        to: [victimDid],
        from_prior: fromPriorJwt,
        body: {},
      },
      {
        recipientKey: toKeyAgreement(victimService.recipientKeys[0]),
        recipientKid: toKeyAgreementDidUrl(victimService.recipientKeys[0]),
        contentEncryptionAlgorithm:
          accepter.dependencyManager.resolve(DidCommModuleConfig).v2DefaultAnoncryptContentEncryption,
      }
    )

    const dispatch = vi.spyOn(accepterTwo.dependencyManager.resolve(DidCommDispatcher), 'dispatch')
    try {
      await accepterTwo.dependencyManager.resolve(DidCommMessageReceiver).receiveMessage(replay)
      expect(dispatch).not.toHaveBeenCalled()
    } finally {
      dispatch.mockRestore()
    }

    // biome-ignore lint/style/noNonNullAssertion: no explanation
    const victimAfter = await accepterTwo.didcomm.connections.getById(victimConnection!.id)
    expect(victimAfter.theirDid).toEqual(invitationDid)
    expect(victimAfter.previousTheirDids).toEqual([])
  })

  async function waitUntilInviterReceives(send: () => Promise<unknown>): Promise<void> {
    const receive = vi.spyOn(inviter.dependencyManager.resolve(DidCommMessageReceiver), 'receiveMessage')
    try {
      await send()
      await vi.waitFor(() => expect(receive).toHaveBeenCalled())
      await Promise.allSettled(receive.mock.results.map((result) => result.value))
    } finally {
      receive.mockRestore()
    }
  }

  test('a single-use invitation creates one connection and is then done', async () => {
    const invitation = await inviter.didcomm.oob.createInvitation({ didCommVersion: 'v2' })

    const { connectionRecord: firstConnection } = await accepter.didcomm.oob.receiveInvitation(
      invitation.outOfBandInvitation,
      { label: '' }
    )
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    await accepter.didcomm.basicMessages.sendMessage(firstConnection!.id, 'first')
    await waitForBasicMessage(inviter, { content: 'first' })
    expect((await inviter.didcomm.oob.getById(invitation.id)).state).toEqual(DidCommOutOfBandState.Done)
    const [inviterConnection] = await inviter.didcomm.connections.getAll()
    await inviter.didcomm.connections.deleteById(inviterConnection.id)

    const { connectionRecord: secondConnection } = await accepterTwo.didcomm.oob.receiveInvitation(
      invitation.outOfBandInvitation,
      { label: '' }
    )
    await waitUntilInviterReceives(() =>
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      accepterTwo.didcomm.basicMessages.sendMessage(secondConnection!.id, 'second')
    )

    expect(await inviter.didcomm.connections.getAll()).toHaveLength(0)
    expect((await inviter.didcomm.oob.getById(invitation.id)).state).toEqual(DidCommOutOfBandState.Done)
  })

  test('a single-use invitation accepts a first message addressed to the short form of its DID', async () => {
    const invitation = await inviter.didcomm.oob.createInvitation({ didCommVersion: 'v2' })
    const invitationDid = invitation.outOfBandInvitation.v2Invitation?.from as string
    const { connectionRecord: accepterConnection } = await accepter.didcomm.oob.receiveInvitation(
      invitation.outOfBandInvitation,
      { label: '' }
    )

    const envelopeService = accepter.dependencyManager.resolve(DidCommV2EnvelopeService)
    const pack = envelopeService.pack.bind(envelopeService)
    const shortFormTo = vi.spyOn(envelopeService, 'pack').mockImplementation((agentContext, payload, keys) =>
      pack(
        agentContext,
        {
          ...(payload as DidCommV2PlaintextMessage),
          to: [getDidPeer4ShortFormForEquivalence(invitationDid) as string],
        },
        keys
      )
    )
    try {
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      await accepter.didcomm.basicMessages.sendMessage(accepterConnection!.id, 'short form')
      await waitForBasicMessage(inviter, { content: 'short form' })
    } finally {
      shortFormTo.mockRestore()
    }

    expect(await inviter.didcomm.connections.findAllByOutOfBandId(invitation.id)).toHaveLength(1)
    expect((await inviter.didcomm.oob.getById(invitation.id)).state).toEqual(DidCommOutOfBandState.Done)
  })

  test('a message from an unknown sender to a pairwise DID creates no connection', async () => {
    const invitation = await inviter.didcomm.oob.createInvitation({ didCommVersion: 'v2', multiUseInvitation: true })
    const { connectionRecord: accepterConnection } = await accepter.didcomm.oob.receiveInvitation(
      invitation.outOfBandInvitation,
      { label: '' }
    )
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    await accepter.didcomm.basicMessages.sendMessage(accepterConnection!.id, 'hello')
    await waitForBasicMessage(inviter, { content: 'hello' })
    const [inviterConnection] = await inviter.didcomm.connections.findAllByOutOfBandId(invitation.id)
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    const pairwiseDid = inviterConnection.did!

    const { connectionRecord: strangerConnection } = await accepterTwo.didcomm.oob.receiveImplicitInvitation({
      did: pairwiseDid,
      didCommVersion: 'v2',
      label: '',
    })
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    const strangerConnectionId = strangerConnection!.id
    await waitUntilInviterReceives(() =>
      accepterTwo.didcomm.basicMessages.sendMessage(strangerConnectionId, 'long form')
    )

    const envelopeService = accepterTwo.dependencyManager.resolve(DidCommV2EnvelopeService)
    const pack = envelopeService.pack.bind(envelopeService)
    const shortFormTo = vi.spyOn(envelopeService, 'pack').mockImplementation((agentContext, payload, keys) =>
      pack(
        agentContext,
        {
          ...(payload as DidCommV2PlaintextMessage),
          to: [getDidPeer4ShortFormForEquivalence(pairwiseDid) as string],
        },
        keys
      )
    )
    try {
      await waitUntilInviterReceives(() =>
        accepterTwo.didcomm.basicMessages.sendMessage(strangerConnectionId, 'short form')
      )
    } finally {
      shortFormTo.mockRestore()
    }

    expect(await inviter.didcomm.connections.getAll()).toHaveLength(1)
  })

  test('a created DID with no invitation or connection works as an implicit invitation', async () => {
    const { did } = await createPeerDidForV2OOB(
      inviter.context,
      await inviter.didcomm.mediationRecipient.getRouting({})
    )

    for (const [invitee, content] of [
      [accepter, 'implicit hello'],
      [accepterTwo, 'implicit hello two'],
    ] as const) {
      const { connectionRecord } = await invitee.didcomm.oob.receiveImplicitInvitation({
        did,
        didCommVersion: 'v2',
        label: '',
      })
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      await invitee.didcomm.basicMessages.sendMessage(connectionRecord!.id, content)
      await waitForBasicMessage(inviter, { content })
    }

    const inviterConnections = await inviter.didcomm.connections.getAll()
    expect(inviterConnections).toHaveLength(2)
    for (const connection of inviterConnections) {
      expect(connection.previousDids).toContain(did)
    }
  })
})
