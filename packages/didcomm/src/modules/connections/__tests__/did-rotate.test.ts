import { first, ReplaySubject, timeout } from 'rxjs'

import { Agent } from '../../../../../core/src/agent/Agent'
import { RecordNotFoundError } from '../../../../../core/src/error'
import { createPeerDidDocumentFromServices } from '../../../../../core/src/modules/dids'
import { uuid } from '../../../../../core/src/utils/uuid'
import { type EventReplaySubject, setupEventReplaySubjects, setupSubjectTransports } from '../../../../../core/tests'
import {
  firstValueWithStackTrace,
  getAgentOptions,
  makeConnection,
  waitForAgentMessageProcessedEventSubject,
  waitForBasicMessageSubject,
  waitForDidRotateSubject,
} from '../../../../../core/tests/helpers'
import { DidCommEventTypes } from '../../../DidCommEvents'
import { DidCommMessageSender } from '../../../DidCommMessageSender'
import { getOutboundDidCommMessageContext } from '../../../getDidCommOutboundMessageContext'
import { DidCommBasicMessage, DidCommBasicMessageEventTypes } from '../../basic-messages'
import { DidCommConnectionEventTypes } from '../DidCommConnectionEvents'
import { DidCommDidRotateAckMessage, DidCommDidRotateProblemReportMessage, DidCommHangupMessage } from '../messages'
import { DidCommConnectionRecord } from '../repository'

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
  let aliceReplay: EventReplaySubject
  let bobReplay: EventReplaySubject

  beforeEach(async () => {
    aliceAgent = new Agent(aliceAgentOptions)
    bobAgent = new Agent(bobAgentOptions)

    setupSubjectTransports([aliceAgent, bobAgent])
    await aliceAgent.initialize()
    await bobAgent.initialize()
    ;[aliceReplay, bobReplay] = setupEventReplaySubjects(
      [aliceAgent, bobAgent],
      [
        DidCommEventTypes.DidCommMessageProcessed,
        DidCommBasicMessageEventTypes.DidCommBasicMessageStateChanged,
        DidCommConnectionEventTypes.DidCommConnectionDidRotated,
      ]
    )
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
      const { threadId: initialMessageThreadId } = await bobAgent.didcomm.basicMessages.sendMessage(
        // biome-ignore lint/style/noNonNullAssertion: no explanation
        bobAliceConnection?.id!,
        'Hello initial did'
      )

      await waitForBasicMessageSubject(aliceReplay, { threadId: initialMessageThreadId, content: 'Hello initial did' })

      // Do did rotate
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      const { newDid } = await aliceAgent.didcomm.connections.rotate({ connectionId: aliceBobConnection?.id! })

      // Wait for acknowledge
      await waitForAgentMessageProcessedEventSubject(aliceReplay, {
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
      const { threadId: newDidMessageThreadId } = await bobAgent.didcomm.basicMessages.sendMessage(
        // biome-ignore lint/style/noNonNullAssertion: no explanation
        bobAliceConnection?.id!,
        'Hello new did'
      )

      await waitForBasicMessageSubject(aliceReplay, {
        threadId: newDidMessageThreadId,
        content: 'Hello new did',
        connectionId: aliceBobConnection?.id,
      })
    })

    test('Rotate succesfully and send messages to previous did afterwards', async () => {
      // Send message to initial did
      const { threadId: initialMessageThreadId } = await bobAgent.didcomm.basicMessages.sendMessage(
        // biome-ignore lint/style/noNonNullAssertion: no explanation
        bobAliceConnection?.id!,
        'Hello initial did'
      )

      await waitForBasicMessageSubject(aliceReplay, { threadId: initialMessageThreadId, content: 'Hello initial did' })

      const messageToPreviousDid = await getOutboundDidCommMessageContext(bobAgent.context, {
        message: new DidCommBasicMessage({ content: 'Message to previous did' }),
        connectionRecord: bobAliceConnection,
      })

      // Do did rotate
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      await aliceAgent.didcomm.connections.rotate({ connectionId: aliceBobConnection?.id! })

      // Wait for acknowledge
      await waitForAgentMessageProcessedEventSubject(aliceReplay, {
        messageType: DidCommDidRotateAckMessage.type.messageTypeUri,
      })

      // Send message to previous did
      await bobAgent.dependencyManager.resolve(DidCommMessageSender).sendMessage(messageToPreviousDid)

      await waitForBasicMessageSubject(aliceReplay, {
        threadId: messageToPreviousDid.message.threadId,
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
      const { threadId: initialMessageThreadId } = await bobAgent.didcomm.basicMessages.sendMessage(
        // biome-ignore lint/style/noNonNullAssertion: no explanation
        bobAliceConnection?.id!,
        'Hello initial did'
      )

      await waitForBasicMessageSubject(aliceReplay, { threadId: initialMessageThreadId, content: 'Hello initial did' })

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
            routingKeys: didRouting.routingKeys,
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
      await waitForAgentMessageProcessedEventSubject(aliceReplay, {
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
      const { threadId: newDidMessageThreadId } = await bobAgent.didcomm.basicMessages.sendMessage(
        // biome-ignore lint/style/noNonNullAssertion: no explanation
        bobAliceConnection?.id!,
        'Hello new did'
      )

      await waitForBasicMessageSubject(aliceReplay, {
        threadId: newDidMessageThreadId,
        content: 'Hello new did',
        connectionId: aliceBobConnection?.id,
      })
    })

    test('Rotate succesfully and send messages to previous did afterwards', async () => {
      // Send message to initial did
      const { threadId: initialMessageThreadId } = await bobAgent.didcomm.basicMessages.sendMessage(
        // biome-ignore lint/style/noNonNullAssertion: no explanation
        bobAliceConnection?.id!,
        'Hello initial did'
      )

      await waitForBasicMessageSubject(aliceReplay, { threadId: initialMessageThreadId, content: 'Hello initial did' })

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
            routingKeys: didRouting.routingKeys,
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

      const waitForAllDidRotate = Promise.all([
        waitForDidRotateSubject(aliceReplay, {}),
        waitForDidRotateSubject(bobReplay, {}),
      ])

      // Do did rotate

      // biome-ignore lint/style/noNonNullAssertion: no explanation
      await aliceAgent.didcomm.connections.rotate({ connectionId: aliceBobConnection?.id!, toDid: did })

      // Wait for acknowledge
      await waitForAgentMessageProcessedEventSubject(aliceReplay, {
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

      await waitForBasicMessageSubject(aliceReplay, {
        threadId: messageToPreviousDid.message.threadId,
        content: 'Message to previous did',
        connectionId: aliceBobConnection?.id,
      })
    })

    test('Rotate failed and send messages to previous did afterwards', async () => {
      // Send message to initial did
      const { threadId: initialMessageThreadId } = await bobAgent.didcomm.basicMessages.sendMessage(
        // biome-ignore lint/style/noNonNullAssertion: no explanation
        bobAliceConnection?.id!,
        'Hello initial did'
      )

      await waitForBasicMessageSubject(aliceReplay, { threadId: initialMessageThreadId, content: 'Hello initial did' })

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
            routingKeys: didRouting.routingKeys,
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
      await waitForAgentMessageProcessedEventSubject(aliceReplay, {
        messageType: DidCommDidRotateProblemReportMessage.type.messageTypeUri,
      })

      // Send message to previous did
      await bobAgent.dependencyManager.resolve(DidCommMessageSender).sendMessage(messageToPreviousDid)

      await waitForBasicMessageSubject(aliceReplay, {
        threadId: messageToPreviousDid.message.threadId,
        content: 'Message to previous did',
        connectionId: aliceBobConnection?.id,
      })

      // Send message to stored did (should be the previous one)
      const { threadId: messageAfterFailureThreadId } = await bobAgent.didcomm.basicMessages.sendMessage(
        // biome-ignore lint/style/noNonNullAssertion: no explanation
        bobAliceConnection?.id!,
        'Message after did rotation failure'
      )

      await waitForBasicMessageSubject(aliceReplay, {
        threadId: messageAfterFailureThreadId,
        content: 'Message after did rotation failure',
        connectionId: aliceBobConnection?.id,
      })
    })
  })

  describe('Hangup', () => {
    test('Hangup without record deletion', async () => {
      // Send message to initial did
      const { threadId: initialMessageThreadId } = await bobAgent.didcomm.basicMessages.sendMessage(
        // biome-ignore lint/style/noNonNullAssertion: no explanation
        bobAliceConnection?.id!,
        'Hello initial did'
      )

      await waitForBasicMessageSubject(aliceReplay, { threadId: initialMessageThreadId, content: 'Hello initial did' })

      // Store an outbound context so we can attempt to send a message even if the connection is terminated.
      // A bit hacky, but may happen in some cases where message retry mechanisms are being used
      const messageBeforeHangup = await getOutboundDidCommMessageContext(bobAgent.context, {
        message: new DidCommBasicMessage({ content: 'Message before hangup' }),
        connectionRecord: bobAliceConnection?.clone(),
      })

      // biome-ignore lint/style/noNonNullAssertion: no explanation
      await aliceAgent.didcomm.connections.hangup({ connectionId: aliceBobConnection?.id! })

      // Wait for hangup
      await waitForAgentMessageProcessedEventSubject(bobReplay, {
        messageType: DidCommHangupMessage.type.messageTypeUri,
      })

      // If Bob attempts to send a message to Alice after they received the hangup, framework should reject it
      await expect(
        // biome-ignore lint/style/noNonNullAssertion: no explanation
        bobAgent.didcomm.basicMessages.sendMessage(bobAliceConnection?.id!, 'Message after hangup')
      ).rejects.toThrow()

      // If Bob sends a message afterwards, Alice should still be able to receive it
      await bobAgent.dependencyManager.resolve(DidCommMessageSender).sendMessage(messageBeforeHangup)

      await waitForBasicMessageSubject(aliceReplay, {
        threadId: messageBeforeHangup.message.threadId,
        content: 'Message before hangup',
        connectionId: aliceBobConnection?.id,
      })
    })

    test('Hangup and delete connection record', async () => {
      // Send message to initial did
      const { threadId: initialMessageThreadId } = await bobAgent.didcomm.basicMessages.sendMessage(
        // biome-ignore lint/style/noNonNullAssertion: no explanation
        bobAliceConnection?.id!,
        'Hello initial did'
      )

      await waitForBasicMessageSubject(aliceReplay, { threadId: initialMessageThreadId, content: 'Hello initial did' })

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
      await waitForAgentMessageProcessedEventSubject(bobReplay, {
        messageType: DidCommHangupMessage.type.messageTypeUri,
      })

      // An error is thrown by Alice agent and, after inspecting all basic messages, it cannot be found
      // TODO: Update as soon as agent sends error events upon reception of messages
      // Subscribe before sending, as delivery may be synchronous
      const observable = aliceAgent.events.observable('AgentReceiveMessageError')
      const subject = new ReplaySubject(1)
      observable.pipe(first(), timeout({ first: 10000 })).subscribe(subject)

      // If Bob sends a message afterwards, Alice should not receive it since the connection has been deleted
      await bobAgent.dependencyManager.resolve(DidCommMessageSender).sendMessage(messageBeforeHangup)

      await firstValueWithStackTrace(subject)

      const aliceBasicMessages = await aliceAgent.didcomm.basicMessages.findAllByQuery({})
      expect(aliceBasicMessages.find((message) => message.content === 'Message before hangup')).toBeUndefined()
    })

    test('Event emitted after processing hangup', async () => {
      // Send message to initial did
      const { threadId: initialMessageThreadId } = await bobAgent.didcomm.basicMessages.sendMessage(
        // biome-ignore lint/style/noNonNullAssertion: no explanation
        bobAliceConnection?.id!,
        'Hello initial did'
      )

      await waitForBasicMessageSubject(aliceReplay, { threadId: initialMessageThreadId, content: 'Hello initial did' })

      // biome-ignore lint/style/noNonNullAssertion: no explanation
      await aliceAgent.didcomm.connections.hangup({ connectionId: aliceBobConnection?.id! })

      // Catch did rotation event message from processHangup()
      const rotationEvent = await waitForDidRotateSubject(bobReplay, {})
      expect(rotationEvent.theirDid?.to).toBeUndefined()
    })
  })
})
