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
import { DidCommMessageSender } from '../../../DidCommMessageSender'
import { getOutboundDidCommMessageContext } from '../../../getDidCommOutboundMessageContext'
import { DidCommBasicMessage } from '../../basic-messages'
import { DidCommDidRotateAckMessage, DidCommDidRotateProblemReportMessage, DidCommHangupMessage } from '../messages'
import { DidCommConnectionRecord } from '../repository'
import { DidCommConnectionMetadataKeys } from '../repository/DidCommConnectionMetadataTypes'
import { DidCommDidRotateV2Service } from '../services/DidCommDidRotateV2Service'

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

  test('alice rotates v2 DID; basic message carries from_prior and bob updates theirDid', async () => {
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    const oldAliceDid = aliceBobConnection?.did!

    const didRotateV2 = aliceAgent.dependencyManager.resolve(DidCommDidRotateV2Service)
    const routing = await aliceAgent.didcomm.mediationRecipient.getRouting({})
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    const { newDid } = await didRotateV2.rotateOurDid(aliceAgent.context, aliceBobConnection!, routing)

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
})
