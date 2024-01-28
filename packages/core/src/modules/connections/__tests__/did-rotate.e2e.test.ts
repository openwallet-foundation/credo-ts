/* eslint-disable @typescript-eslint/no-non-null-assertion */

import type { ConnectionRecord } from '../repository'

import { MessageSender } from '../../..//agent/MessageSender'
import { getIndySdkModules } from '../../../../../indy-sdk/tests/setupIndySdkModule'
import { setupSubjectTransports, testLogger } from '../../../../tests'
import {
  getAgentOptions,
  makeConnection,
  waitForAgentMessageProcessedEvent,
  waitForBasicMessage,
} from '../../../../tests/helpers'
import { Agent } from '../../../agent/Agent'
import { getOutboundMessageContext } from '../../../agent/getOutboundMessageContext'
import { uuid } from '../../../utils/uuid'
import { BasicMessage } from '../../basic-messages'
import { DidsModule, createPeerDidDocumentFromServices } from '../../dids'
import { ConnectionsModule } from '../ConnectionsModule'
import { RotateAckMessage } from '../messages'

import { InMemoryDidRegistry } from './InMemoryDidRegistry'

// This is the most common flow
describe('Rotation E2E tests', () => {
  let aliceAgent: Agent
  let bobAgent: Agent
  let aliceBobConnection: ConnectionRecord | undefined
  let bobAliceConnection: ConnectionRecord | undefined

  beforeEach(async () => {
    // Make a common in-memory did registry for both agents
    const didRegistry = new InMemoryDidRegistry()

    const aliceAgentOptions = getAgentOptions(
      'DID Rotate Alice',
      {
        label: 'alice',
        endpoints: ['rxjs:alice'],
        logger: testLogger,
      },
      {
        ...getIndySdkModules(),
        connections: new ConnectionsModule({
          autoAcceptConnections: true,
        }),
        dids: new DidsModule({ registrars: [didRegistry], resolvers: [didRegistry] }),
      }
    )
    const bobAgentOptions = getAgentOptions(
      'DID Rotate Bob',
      {
        label: 'bob',
        endpoints: ['rxjs:bob'],
        logger: testLogger,
      },
      {
        ...getIndySdkModules(),
        connections: new ConnectionsModule({
          autoAcceptConnections: true,
        }),
        dids: new DidsModule({ registrars: [didRegistry], resolvers: [didRegistry] }),
      }
    )

    aliceAgent = new Agent(aliceAgentOptions)
    bobAgent = new Agent(bobAgentOptions)

    setupSubjectTransports([aliceAgent, bobAgent])
    await aliceAgent.initialize()
    await bobAgent.initialize()
    ;[aliceBobConnection, bobAliceConnection] = await makeConnection(aliceAgent, bobAgent)
  })

  afterEach(async () => {
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
    await bobAgent.shutdown()
    await bobAgent.wallet.delete()
  })

  describe('Rotation from did:peer:1 to did:peer:4', () => {
    test('Rotate succesfully and send messages to new did afterwards', async () => {
      const oldDid = aliceBobConnection!.did
      expect(bobAliceConnection!.theirDid).toEqual(oldDid)

      // Send message to initial did
      await bobAgent.basicMessages.sendMessage(bobAliceConnection!.id, 'Hello initial did')

      await waitForBasicMessage(aliceAgent, { content: 'Hello initial did' })

      // Do did rotate
      const { did: newDid } = await aliceAgent.connections.rotate({ connectionId: aliceBobConnection!.id })

      // Wait for acknowledge
      await waitForAgentMessageProcessedEvent(aliceAgent, { messageType: RotateAckMessage.type.messageTypeUri })

      // Check that new did is taken into account by both parties
      const newAliceBobConnection = await aliceAgent.connections.getById(aliceBobConnection!.id)
      const newBobAliceConnection = await bobAgent.connections.getById(bobAliceConnection!.id)

      expect(newAliceBobConnection.did).toEqual(newDid)
      expect(newBobAliceConnection.theirDid).toEqual(newDid)

      // And also they store it into previous dids array
      expect(newAliceBobConnection.previousDids).toContain(oldDid)
      expect(newBobAliceConnection.previousTheirDids).toContain(oldDid)

      // Send message to new did
      await bobAgent.basicMessages.sendMessage(bobAliceConnection!.id, 'Hello new did')

      await waitForBasicMessage(aliceAgent, { content: 'Hello new did', connectionId: aliceBobConnection!.id })
    })

    test('Rotate succesfully and send messages to previous did afterwards', async () => {
      // Send message to initial did
      await bobAgent.basicMessages.sendMessage(bobAliceConnection!.id, 'Hello initial did')

      await waitForBasicMessage(aliceAgent, { content: 'Hello initial did' })

      const messageToPreviousDid = await getOutboundMessageContext(bobAgent.context, {
        message: new BasicMessage({ content: 'Message to previous did' }),
        connectionRecord: bobAliceConnection,
      })

      // Do did rotate
      await aliceAgent.connections.rotate({ connectionId: aliceBobConnection!.id })

      // Wait for acknowledge
      await waitForAgentMessageProcessedEvent(aliceAgent, { messageType: RotateAckMessage.type.messageTypeUri })

      // Send message to previous did
      await bobAgent.dependencyManager.resolve(MessageSender).sendMessage(messageToPreviousDid)

      await waitForBasicMessage(aliceAgent, {
        content: 'Message to previous did',
        connectionId: aliceBobConnection!.id,
      })
    })
  })

  describe('Rotation specifying did and routing externally', () => {
    test('Rotate succesfully and send messages to new did afterwards', async () => {
      const oldDid = aliceBobConnection!.did
      expect(bobAliceConnection!.theirDid).toEqual(oldDid)

      // Send message to initial did
      await bobAgent.basicMessages.sendMessage(bobAliceConnection!.id, 'Hello initial did')

      await waitForBasicMessage(aliceAgent, { content: 'Hello initial did' })

      // Create a new external did
      const didRouting = await aliceAgent.mediationRecipient.getRouting({})
      const did = `did:inmemory:${uuid()}`
      const didDocument = createPeerDidDocumentFromServices([
        {
          id: 'didcomm',
          recipientKeys: [didRouting.recipientKey],
          routingKeys: didRouting.routingKeys,
          serviceEndpoint: didRouting.endpoints[0],
        },
      ])
      didDocument.id = did

      await aliceAgent.dids.create({
        did,
        didDocument,
      })

      // Do did rotate
      const { did: newDid } = await aliceAgent.connections.rotate({
        connectionId: aliceBobConnection!.id,
        did,
      })

      // Wait for acknowledge
      await waitForAgentMessageProcessedEvent(aliceAgent, { messageType: RotateAckMessage.type.messageTypeUri })

      // Check that new did is taken into account by both parties
      const newAliceBobConnection = await aliceAgent.connections.getById(aliceBobConnection!.id)
      const newBobAliceConnection = await bobAgent.connections.getById(bobAliceConnection!.id)

      expect(newAliceBobConnection.did).toEqual(newDid)
      expect(newBobAliceConnection.theirDid).toEqual(newDid)

      // And also they store it into previous dids array
      expect(newAliceBobConnection.previousDids).toContain(oldDid)
      expect(newBobAliceConnection.previousTheirDids).toContain(oldDid)

      // Send message to new did
      await bobAgent.basicMessages.sendMessage(bobAliceConnection!.id, 'Hello new did')

      await waitForBasicMessage(aliceAgent, { content: 'Hello new did', connectionId: aliceBobConnection!.id })
    })

    test('Rotate succesfully and send messages to previous did afterwards', async () => {
      // Send message to initial did
      await bobAgent.basicMessages.sendMessage(bobAliceConnection!.id, 'Hello initial did')

      await waitForBasicMessage(aliceAgent, { content: 'Hello initial did' })

      const messageToPreviousDid = await getOutboundMessageContext(bobAgent.context, {
        message: new BasicMessage({ content: 'Message to previous did' }),
        connectionRecord: bobAliceConnection,
      })

      // Create a new external did
      const didRouting = await aliceAgent.mediationRecipient.getRouting({})
      const did = `did:inmemory:${uuid()}`
      const didDocument = createPeerDidDocumentFromServices([
        {
          id: 'didcomm',
          recipientKeys: [didRouting.recipientKey],
          routingKeys: didRouting.routingKeys,
          serviceEndpoint: didRouting.endpoints[0],
        },
      ])
      didDocument.id = did

      await aliceAgent.dids.create({
        did,
        didDocument,
      })

      // Do did rotate
      await aliceAgent.connections.rotate({ connectionId: aliceBobConnection!.id, did })

      // Wait for acknowledge
      await waitForAgentMessageProcessedEvent(aliceAgent, { messageType: RotateAckMessage.type.messageTypeUri })

      // Send message to previous did
      await bobAgent.dependencyManager.resolve(MessageSender).sendMessage(messageToPreviousDid)

      await waitForBasicMessage(aliceAgent, {
        content: 'Message to previous did',
        connectionId: aliceBobConnection!.id,
      })
    })

    test.skip('Rotate failed and send messages to previous and new did afterwards', async () => {})
  })

  describe('Hangup', () => {
    test.skip('Hangup and delete connection record', async () => {})

    test.skip('Hangup without record deletion', async () => {})
  })
})
