import type { EncryptedDidCommMessage } from '../../../../../types'

import { EventEmitter } from '../../../../../../../core/src/agent/EventEmitter'
import { CredoError } from '../../../../../../../core/src/error'
import { verkeyToDidKey } from '../../../../../../../core/src/modules/dids/helpers'
import { uuid } from '../../../../../../../core/src/utils/uuid'
import { getAgentContext, getMockConnection, mockFunction } from '../../../../../../../core/tests/helpers'
import { DidCommModuleConfig } from '../../../../../DidCommModuleConfig'
import { DidCommEventTypes } from '../../../../../DidCommEvents'
import { DidCommMessageSender } from '../../../../../DidCommMessageSender'
import { Attachment } from '../../../../../decorators/attachment/Attachment'
import { InboundDidCommMessageContext } from '../../../../../models'
import { InMemoryQueueTransportRepository } from '../../../../../transport/queue/InMemoryQueueTransportRepository'
import { DidCommConnectionService, DidCommDidExchangeState, TrustPingMessage } from '../../../../connections'
import { DidCommMessagePickupModuleConfig } from '../../../DidCommMessagePickupModuleConfig'
import { V1DidCommMessagePickupProtocol } from '../../v1'
import { V2DidCommMessagePickupProtocol } from '../V2DidCommMessagePickupProtocol'
import {
  V2DeliveryRequestMessage,
  V2MessageDeliveryMessage,
  V2MessagesReceivedMessage,
  V2StatusMessage,
  V2StatusRequestMessage,
} from '../messages'

const mockConnection = getMockConnection({
  state: DidCommDidExchangeState.Completed,
})

// Mock classes
jest.mock('../../../../../transport/queue/InMemoryQueueTransportRepository')
jest.mock('../../../../../../../core/src/agent/EventEmitter')
jest.mock('../../../../../DidCommMessageSender')
jest.mock('../../../../connections/services/DidCommConnectionService')

// Mock typed object
const InMessageRepositoryMock = InMemoryQueueTransportRepository as jest.Mock<InMemoryQueueTransportRepository>
const EventEmitterMock = EventEmitter as jest.Mock<EventEmitter>
const MessageSenderMock = DidCommMessageSender as jest.Mock<DidCommMessageSender>
const ConnectionServiceMock = DidCommConnectionService as jest.Mock<DidCommConnectionService>

const queueTransportRepository = new InMessageRepositoryMock()

const didCommModuleConfig = new DidCommModuleConfig({ queueTransportRepository })
const messagePickupModuleConfig = new DidCommMessagePickupModuleConfig({
  maximumBatchSize: 10,
  protocols: [new V1DidCommMessagePickupProtocol(), new V2DidCommMessagePickupProtocol()],
})
const messageSender = new MessageSenderMock()
const eventEmitter = new EventEmitterMock()
const connectionService = new ConnectionServiceMock()

const agentContext = getAgentContext({
  registerInstances: [
    [EventEmitter, eventEmitter],
    [DidCommMessageSender, messageSender],
    [DidCommConnectionService, connectionService],
    [DidCommModuleConfig, didCommModuleConfig],
    [DidCommMessagePickupModuleConfig, messagePickupModuleConfig],
  ],
})

const encryptedMessage: EncryptedDidCommMessage = {
  protected: 'base64url',
  iv: 'base64url',
  ciphertext: 'base64url',
  tag: 'base64url',
}
const queuedMessages = [
  { id: '1', encryptedMessage, receivedAt: new Date() },
  { id: '2', encryptedMessage, receivedAt: new Date() },
  { id: '3', encryptedMessage, receivedAt: new Date() },
]

describe('V2MessagePickupProtocol', () => {
  let pickupProtocol: V2DidCommMessagePickupProtocol

  beforeEach(async () => {
    pickupProtocol = new V2DidCommMessagePickupProtocol()
  })

  describe('processStatusRequest', () => {
    test('no available messages in queue', async () => {
      mockFunction(queueTransportRepository.getAvailableMessageCount).mockResolvedValue(0)

      const statusRequest = new V2StatusRequestMessage({})

      const messageContext = new InboundDidCommMessageContext(statusRequest, { connection: mockConnection, agentContext })

      const { connection, message } = await pickupProtocol.processStatusRequest(messageContext)

      expect(connection).toEqual(mockConnection)
      expect(message).toEqual(
        new V2StatusMessage({
          id: message.id,
          threadId: statusRequest.threadId,
          messageCount: 0,
        })
      )
      expect(queueTransportRepository.getAvailableMessageCount).toHaveBeenCalledWith(agentContext, {
        connectionId: mockConnection.id,
      })
    })

    test('multiple messages in queue', async () => {
      mockFunction(queueTransportRepository.getAvailableMessageCount).mockResolvedValue(5)
      const statusRequest = new V2StatusRequestMessage({})

      const messageContext = new InboundDidCommMessageContext(statusRequest, { connection: mockConnection, agentContext })

      const { connection, message } = await pickupProtocol.processStatusRequest(messageContext)

      expect(connection).toEqual(mockConnection)
      expect(message).toEqual(
        new V2StatusMessage({
          id: message.id,
          threadId: statusRequest.threadId,
          messageCount: 5,
        })
      )
      expect(queueTransportRepository.getAvailableMessageCount).toHaveBeenCalledWith(agentContext, {
        connectionId: mockConnection.id,
      })
    })

    test('status request specifying recipient key', async () => {
      mockFunction(queueTransportRepository.getAvailableMessageCount).mockResolvedValue(10)

      const statusRequest = new V2StatusRequestMessage({
        recipientKey: '79CXkde3j8TNuMXxPdV7nLUrT2g7JAEjH5TreyVY7GEZ',
      })

      const messageContext = new InboundDidCommMessageContext(statusRequest, { connection: mockConnection, agentContext })

      await pickupProtocol.processStatusRequest(messageContext)
      expect(queueTransportRepository.getAvailableMessageCount).toHaveBeenCalledWith(agentContext, {
        connectionId: mockConnection.id,
      })
    })
  })

  describe('processDeliveryRequest', () => {
    test('no available messages in queue', async () => {
      mockFunction(queueTransportRepository.takeFromQueue).mockReturnValue([])

      const deliveryRequest = new V2DeliveryRequestMessage({ limit: 10 })

      const messageContext = new InboundDidCommMessageContext(deliveryRequest, { connection: mockConnection, agentContext })

      const { connection, message } = await pickupProtocol.processDeliveryRequest(messageContext)

      expect(connection).toEqual(mockConnection)
      expect(message).toEqual(
        new V2StatusMessage({
          id: message.id,
          threadId: deliveryRequest.threadId,
          messageCount: 0,
        })
      )
      expect(queueTransportRepository.takeFromQueue).toHaveBeenCalledWith(agentContext, {
        connectionId: mockConnection.id,
        limit: 10,
      })
    })

    test('less messages in queue than limit', async () => {
      mockFunction(queueTransportRepository.takeFromQueue).mockReturnValue(queuedMessages)

      const deliveryRequest = new V2DeliveryRequestMessage({ limit: 10 })

      const messageContext = new InboundDidCommMessageContext(deliveryRequest, { connection: mockConnection, agentContext })

      const { connection, message } = await pickupProtocol.processDeliveryRequest(messageContext)

      expect(connection).toEqual(mockConnection)
      expect(message).toBeInstanceOf(V2MessageDeliveryMessage)
      expect(message.threadId).toEqual(deliveryRequest.threadId)
      expect(message.appendedAttachments?.length).toEqual(3)
      expect(message.appendedAttachments).toEqual(
        expect.arrayContaining(
          queuedMessages.map((msg) =>
            expect.objectContaining({
              id: msg.id,
              data: {
                json: msg.encryptedMessage,
              },
            })
          )
        )
      )
      expect(queueTransportRepository.takeFromQueue).toHaveBeenCalledWith(agentContext, {
        connectionId: mockConnection.id,
        limit: 10,
      })
    })

    test('more messages in queue than limit', async () => {
      mockFunction(queueTransportRepository.takeFromQueue).mockReturnValue(queuedMessages.slice(0, 2))

      const deliveryRequest = new V2DeliveryRequestMessage({ limit: 2 })

      const messageContext = new InboundDidCommMessageContext(deliveryRequest, { connection: mockConnection, agentContext })

      const { connection, message } = await pickupProtocol.processDeliveryRequest(messageContext)

      expect(connection).toEqual(mockConnection)
      expect(message).toBeInstanceOf(V2MessageDeliveryMessage)
      expect(message.threadId).toEqual(deliveryRequest.threadId)
      expect(message.appendedAttachments?.length).toEqual(2)
      expect(message.appendedAttachments).toEqual(
        expect.arrayContaining(
          queuedMessages.slice(0, 2).map((msg) =>
            expect.objectContaining({
              id: msg.id,
              data: {
                json: msg.encryptedMessage,
              },
            })
          )
        )
      )
      expect(queueTransportRepository.takeFromQueue).toHaveBeenCalledWith(agentContext, {
        connectionId: mockConnection.id,
        limit: 2,
      })
    })

    test('delivery request specifying recipient key', async () => {
      mockFunction(queueTransportRepository.takeFromQueue).mockReturnValue(queuedMessages)

      const deliveryRequest = new V2DeliveryRequestMessage({
        limit: 10,
        recipientKey: 'recipientKey',
      })

      const messageContext = new InboundDidCommMessageContext(deliveryRequest, { connection: mockConnection, agentContext })

      await pickupProtocol.processDeliveryRequest(messageContext)

      expect(queueTransportRepository.takeFromQueue).toHaveBeenCalledWith(agentContext, {
        connectionId: mockConnection.id,
        limit: 10,
        recipientDid: verkeyToDidKey('recipientKey'),
      })
    })
  })

  describe('processMessagesReceived', () => {
    test('messages received partially', async () => {
      mockFunction(queueTransportRepository.takeFromQueue).mockReturnValue(queuedMessages)
      mockFunction(queueTransportRepository.getAvailableMessageCount).mockResolvedValue(4)

      const messagesReceived = new V2MessagesReceivedMessage({
        messageIdList: ['1', '2'],
      })

      const messageContext = new InboundDidCommMessageContext(messagesReceived, { connection: mockConnection, agentContext })

      const { connection, message } = await pickupProtocol.processMessagesReceived(messageContext)

      expect(connection).toEqual(mockConnection)
      expect(message).toEqual(
        new V2StatusMessage({
          id: message.id,
          threadId: messagesReceived.threadId,
          messageCount: 4,
        })
      )
      expect(queueTransportRepository.getAvailableMessageCount).toHaveBeenCalledWith(agentContext, {
        connectionId: mockConnection.id,
      })
      expect(queueTransportRepository.removeMessages).toHaveBeenCalledWith(agentContext, {
        connectionId: mockConnection.id,
        messageIds: ['1', '2'],
      })
    })

    test('all messages have been received', async () => {
      mockFunction(queueTransportRepository.takeFromQueue).mockReturnValue(queuedMessages)
      mockFunction(queueTransportRepository.getAvailableMessageCount).mockResolvedValue(0)

      const messagesReceived = new V2MessagesReceivedMessage({
        messageIdList: ['1', '2'],
      })

      const messageContext = new InboundDidCommMessageContext(messagesReceived, { connection: mockConnection, agentContext })

      const { connection, message } = await pickupProtocol.processMessagesReceived(messageContext)

      expect(connection).toEqual(mockConnection)
      expect(message).toEqual(
        new V2StatusMessage({
          id: message.id,
          threadId: messagesReceived.threadId,
          messageCount: 0,
        })
      )

      expect(queueTransportRepository.getAvailableMessageCount).toHaveBeenCalledWith(agentContext, {
        connectionId: mockConnection.id,
      })
      expect(queueTransportRepository.removeMessages).toHaveBeenCalledWith(agentContext, {
        connectionId: mockConnection.id,
        messageIds: ['1', '2'],
      })
    })
  })

  describe('createPickupMessage', () => {
    it('creates a status request message', async () => {
      const { message: statusRequestMessage } = await pickupProtocol.createPickupMessage(agentContext, {
        connectionRecord: mockConnection,
        recipientDid: 'a-key',
      })

      expect(statusRequestMessage).toMatchObject({
        id: expect.any(String),
        recipientKey: 'a-key',
      })
    })
  })

  describe('processStatus', () => {
    it('if status request has a message count of zero returns nothing', async () => {
      const status = new V2StatusMessage({
        threadId: uuid(),
        messageCount: 0,
      })

      mockFunction(connectionService.createTrustPing).mockResolvedValueOnce({
        message: new TrustPingMessage({}),
        connectionRecord: mockConnection,
      })

      const messageContext = new InboundDidCommMessageContext(status, { connection: mockConnection, agentContext })
      const deliveryRequestMessage = await pickupProtocol.processStatus(messageContext)
      expect(deliveryRequestMessage).toBeNull()
    })

    it('if it has a message count greater than zero return a valid delivery request', async () => {
      const status = new V2StatusMessage({
        threadId: uuid(),
        messageCount: 1,
      })
      const messageContext = new InboundDidCommMessageContext(status, { connection: mockConnection, agentContext })

      const deliveryRequestMessage = await pickupProtocol.processStatus(messageContext)
      expect(deliveryRequestMessage)
      expect(deliveryRequestMessage).toEqual(new V2DeliveryRequestMessage({ id: deliveryRequestMessage?.id, limit: 1 }))
    })
  })

  describe('processDelivery', () => {
    it('if the delivery has no attachments expect an error', async () => {
      const messageContext = new InboundDidCommMessageContext({} as V2MessageDeliveryMessage, {
        connection: mockConnection,
        agentContext,
      })

      await expect(pickupProtocol.processDelivery(messageContext)).rejects.toThrowError(
        new CredoError('Error processing attachments')
      )
    })

    it('should return a message received with an message id list in it', async () => {
      const messageDeliveryMessage = new V2MessageDeliveryMessage({
        threadId: uuid(),
        attachments: [
          new Attachment({
            id: '1',
            data: {
              json: {
                a: 'value',
              },
            },
          }),
        ],
      })
      const messageContext = new InboundDidCommMessageContext(messageDeliveryMessage, {
        connection: mockConnection,
        agentContext,
      })

      const messagesReceivedMessage = await pickupProtocol.processDelivery(messageContext)

      expect(messagesReceivedMessage).toEqual(
        new V2MessagesReceivedMessage({
          id: messagesReceivedMessage.id,
          messageIdList: ['1'],
        })
      )
    })

    it('calls the event emitter for each message', async () => {
      // This is to not take into account events previously emitted
      jest.clearAllMocks()

      const messageDeliveryMessage = new V2MessageDeliveryMessage({
        threadId: uuid(),
        attachments: [
          new Attachment({
            id: '1',
            data: {
              json: {
                first: 'value',
              },
            },
          }),
          new Attachment({
            id: '2',
            data: {
              json: {
                second: 'value',
              },
            },
          }),
        ],
      })
      const messageContext = new InboundDidCommMessageContext(messageDeliveryMessage, {
        connection: mockConnection,
        agentContext,
      })

      await pickupProtocol.processDelivery(messageContext)

      expect(eventEmitter.emit).toHaveBeenCalledTimes(2)
      expect(eventEmitter.emit).toHaveBeenNthCalledWith(1, agentContext, {
        type: DidCommEventTypes.DidCommMessageReceived,
        payload: {
          message: { first: 'value' },
          contextCorrelationId: agentContext.contextCorrelationId,
        },
      })
      expect(eventEmitter.emit).toHaveBeenNthCalledWith(2, agentContext, {
        type: DidCommEventTypes.DidCommMessageReceived,
        payload: {
          message: { second: 'value' },
          contextCorrelationId: agentContext.contextCorrelationId,
        },
      })
    })
  })
})
