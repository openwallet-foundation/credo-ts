import type { EncryptedMessage } from '../../../../../types'

import { getAgentContext, getMockConnection, mockFunction } from '../../../../../../tests/helpers'
import { EventEmitter } from '../../../../../agent/EventEmitter'
import { AgentEventTypes } from '../../../../../agent/Events'
import { MessageSender } from '../../../../../agent/MessageSender'
import { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import { InjectionSymbols } from '../../../../../constants'
import { Attachment } from '../../../../../decorators/attachment/Attachment'
import { AriesFrameworkError } from '../../../../../error'
import { InMemoryMessageRepository } from '../../../../../storage/InMemoryMessageRepository'
import { uuid } from '../../../../../utils/uuid'
import { DidExchangeState, TrustPingMessage } from '../../../../connections'
import { ConnectionService } from '../../../../connections/services/ConnectionService'
import { MessagePickupModuleConfig } from '../../../MessagePickupModuleConfig'
import { V1MessagePickupProtocol } from '../../v1'
import { V2MessagePickupProtocol } from '../V2MessagePickupProtocol'
import {
  V2DeliveryRequestMessage,
  V2MessageDeliveryMessage,
  V2MessagesReceivedMessage,
  V2StatusMessage,
  V2StatusRequestMessage,
} from '../messages'

const mockConnection = getMockConnection({
  state: DidExchangeState.Completed,
})

// Mock classes
jest.mock('../../../../../storage/InMemoryMessageRepository')
jest.mock('../../../../../agent/EventEmitter')
jest.mock('../../../../../agent/MessageSender')
jest.mock('../../../../connections/services/ConnectionService')

// Mock typed object
const InMessageRepositoryMock = InMemoryMessageRepository as jest.Mock<InMemoryMessageRepository>
const EventEmitterMock = EventEmitter as jest.Mock<EventEmitter>
const MessageSenderMock = MessageSender as jest.Mock<MessageSender>
const ConnectionServiceMock = ConnectionService as jest.Mock<ConnectionService>

const messagePickupModuleConfig = new MessagePickupModuleConfig({
  maximumBatchSize: 10,
  protocols: [new V1MessagePickupProtocol(), new V2MessagePickupProtocol()],
})
const messageSender = new MessageSenderMock()
const eventEmitter = new EventEmitterMock()
const connectionService = new ConnectionServiceMock()
const messageRepository = new InMessageRepositoryMock()

const agentContext = getAgentContext({
  registerInstances: [
    [InjectionSymbols.MessageRepository, messageRepository],
    [EventEmitter, eventEmitter],
    [MessageSender, messageSender],
    [ConnectionService, connectionService],
    [MessagePickupModuleConfig, messagePickupModuleConfig],
  ],
})

const encryptedMessage: EncryptedMessage = {
  protected: 'base64url',
  iv: 'base64url',
  ciphertext: 'base64url',
  tag: 'base64url',
}
const queuedMessages = [encryptedMessage, encryptedMessage, encryptedMessage]

describe('V2MessagePickupService', () => {
  let pickupProtocol: V2MessagePickupProtocol

  beforeEach(async () => {
    pickupProtocol = new V2MessagePickupProtocol()
  })

  describe('processStatusRequest', () => {
    test('no available messages in queue', async () => {
      mockFunction(messageRepository.getAvailableMessageCount).mockResolvedValue(0)

      const statusRequest = new V2StatusRequestMessage({})

      const messageContext = new InboundMessageContext(statusRequest, { connection: mockConnection, agentContext })

      const { connection, message } = await pickupProtocol.processStatusRequest(messageContext)

      expect(connection).toEqual(mockConnection)
      expect(message).toEqual(
        new V2StatusMessage({
          id: message.id,
          threadId: statusRequest.threadId,
          messageCount: 0,
        })
      )
      expect(messageRepository.getAvailableMessageCount).toHaveBeenCalledWith(mockConnection.id)
    })

    test('multiple messages in queue', async () => {
      mockFunction(messageRepository.getAvailableMessageCount).mockResolvedValue(5)
      const statusRequest = new V2StatusRequestMessage({})

      const messageContext = new InboundMessageContext(statusRequest, { connection: mockConnection, agentContext })

      const { connection, message } = await pickupProtocol.processStatusRequest(messageContext)

      expect(connection).toEqual(mockConnection)
      expect(message).toEqual(
        new V2StatusMessage({
          id: message.id,
          threadId: statusRequest.threadId,
          messageCount: 5,
        })
      )
      expect(messageRepository.getAvailableMessageCount).toHaveBeenCalledWith(mockConnection.id)
    })

    test('status request specifying recipient key', async () => {
      mockFunction(messageRepository.getAvailableMessageCount).mockResolvedValue(10)

      const statusRequest = new V2StatusRequestMessage({
        recipientKey: 'recipientKey',
      })

      const messageContext = new InboundMessageContext(statusRequest, { connection: mockConnection, agentContext })

      await expect(pickupProtocol.processStatusRequest(messageContext)).rejects.toThrowError(
        'recipient_key parameter not supported'
      )
    })
  })

  describe('processDeliveryRequest', () => {
    test('no available messages in queue', async () => {
      mockFunction(messageRepository.takeFromQueue).mockReturnValue([])

      const deliveryRequest = new V2DeliveryRequestMessage({ limit: 10 })

      const messageContext = new InboundMessageContext(deliveryRequest, { connection: mockConnection, agentContext })

      const { connection, message } = await pickupProtocol.processDeliveryRequest(messageContext)

      expect(connection).toEqual(mockConnection)
      expect(message).toEqual(
        new V2StatusMessage({
          id: message.id,
          threadId: deliveryRequest.threadId,
          messageCount: 0,
        })
      )
      expect(messageRepository.takeFromQueue).toHaveBeenCalledWith(mockConnection.id, 10, true)
    })

    test('less messages in queue than limit', async () => {
      mockFunction(messageRepository.takeFromQueue).mockReturnValue(queuedMessages)

      const deliveryRequest = new V2DeliveryRequestMessage({ limit: 10 })

      const messageContext = new InboundMessageContext(deliveryRequest, { connection: mockConnection, agentContext })

      const { connection, message } = await pickupProtocol.processDeliveryRequest(messageContext)

      expect(connection).toEqual(mockConnection)
      expect(message).toBeInstanceOf(V2MessageDeliveryMessage)
      expect(message.threadId).toEqual(deliveryRequest.threadId)
      expect(message.appendedAttachments?.length).toEqual(3)
      expect(message.appendedAttachments).toEqual(
        expect.arrayContaining(
          queuedMessages.map((msg) =>
            expect.objectContaining({
              data: {
                json: msg,
              },
            })
          )
        )
      )
      expect(messageRepository.takeFromQueue).toHaveBeenCalledWith(mockConnection.id, 10, true)
    })

    test('more messages in queue than limit', async () => {
      mockFunction(messageRepository.takeFromQueue).mockReturnValue(queuedMessages.slice(0, 2))

      const deliveryRequest = new V2DeliveryRequestMessage({ limit: 2 })

      const messageContext = new InboundMessageContext(deliveryRequest, { connection: mockConnection, agentContext })

      const { connection, message } = await pickupProtocol.processDeliveryRequest(messageContext)

      expect(connection).toEqual(mockConnection)
      expect(message).toBeInstanceOf(V2MessageDeliveryMessage)
      expect(message.threadId).toEqual(deliveryRequest.threadId)
      expect(message.appendedAttachments?.length).toEqual(2)
      expect(message.appendedAttachments).toEqual(
        expect.arrayContaining(
          queuedMessages.slice(0, 2).map((msg) =>
            expect.objectContaining({
              data: {
                json: msg,
              },
            })
          )
        )
      )
      expect(messageRepository.takeFromQueue).toHaveBeenCalledWith(mockConnection.id, 2, true)
    })

    test('delivery request specifying recipient key', async () => {
      mockFunction(messageRepository.takeFromQueue).mockReturnValue(queuedMessages)

      const statusRequest = new V2DeliveryRequestMessage({
        limit: 10,
        recipientKey: 'recipientKey',
      })

      const messageContext = new InboundMessageContext(statusRequest, { connection: mockConnection, agentContext })

      await expect(pickupProtocol.processStatusRequest(messageContext)).rejects.toThrowError(
        'recipient_key parameter not supported'
      )
    })
  })

  describe('processMessagesReceived', () => {
    test('messages received partially', async () => {
      mockFunction(messageRepository.takeFromQueue).mockReturnValue(queuedMessages)
      mockFunction(messageRepository.getAvailableMessageCount).mockResolvedValue(4)

      const messagesReceived = new V2MessagesReceivedMessage({
        messageIdList: ['1', '2'],
      })

      const messageContext = new InboundMessageContext(messagesReceived, { connection: mockConnection, agentContext })

      const { connection, message } = await pickupProtocol.processMessagesReceived(messageContext)

      expect(connection).toEqual(mockConnection)
      expect(message).toEqual(
        new V2StatusMessage({
          id: message.id,
          threadId: messagesReceived.threadId,
          messageCount: 4,
        })
      )
      expect(messageRepository.getAvailableMessageCount).toHaveBeenCalledWith(mockConnection.id)
      expect(messageRepository.takeFromQueue).toHaveBeenCalledWith(mockConnection.id, 2)
    })

    test('all messages have been received', async () => {
      mockFunction(messageRepository.takeFromQueue).mockReturnValue(queuedMessages)
      mockFunction(messageRepository.getAvailableMessageCount).mockResolvedValue(0)

      const messagesReceived = new V2MessagesReceivedMessage({
        messageIdList: ['1', '2'],
      })

      const messageContext = new InboundMessageContext(messagesReceived, { connection: mockConnection, agentContext })

      const { connection, message } = await pickupProtocol.processMessagesReceived(messageContext)

      expect(connection).toEqual(mockConnection)
      expect(message).toEqual(
        new V2StatusMessage({
          id: message.id,
          threadId: messagesReceived.threadId,
          messageCount: 0,
        })
      )

      expect(messageRepository.getAvailableMessageCount).toHaveBeenCalledWith(mockConnection.id)
      expect(messageRepository.takeFromQueue).toHaveBeenCalledWith(mockConnection.id, 2)
    })
  })

  describe('pickupMessages', () => {
    it('creates a status request message', async () => {
      const { message: statusRequestMessage } = await pickupProtocol.pickupMessages(agentContext, {
        connectionRecord: mockConnection,
        recipientKey: 'a-key',
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

      const messageContext = new InboundMessageContext(status, { connection: mockConnection, agentContext })
      const deliveryRequestMessage = await pickupProtocol.processStatus(messageContext)
      expect(deliveryRequestMessage).toBeNull()
    })

    it('if it has a message count greater than zero return a valid delivery request', async () => {
      const status = new V2StatusMessage({
        threadId: uuid(),
        messageCount: 1,
      })
      const messageContext = new InboundMessageContext(status, { connection: mockConnection, agentContext })

      const deliveryRequestMessage = await pickupProtocol.processStatus(messageContext)
      expect(deliveryRequestMessage)
      expect(deliveryRequestMessage).toEqual(new V2DeliveryRequestMessage({ id: deliveryRequestMessage?.id, limit: 1 }))
    })
  })

  describe('processDelivery', () => {
    it('if the delivery has no attachments expect an error', async () => {
      const messageContext = new InboundMessageContext({} as V2MessageDeliveryMessage, {
        connection: mockConnection,
        agentContext,
      })

      await expect(pickupProtocol.processDelivery(messageContext)).rejects.toThrowError(
        new AriesFrameworkError('Error processing attachments')
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
      const messageContext = new InboundMessageContext(messageDeliveryMessage, {
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
      const messageContext = new InboundMessageContext(messageDeliveryMessage, {
        connection: mockConnection,
        agentContext,
      })

      await pickupProtocol.processDelivery(messageContext)

      expect(eventEmitter.emit).toHaveBeenCalledTimes(2)
      expect(eventEmitter.emit).toHaveBeenNthCalledWith(1, agentContext, {
        type: AgentEventTypes.AgentMessageReceived,
        payload: {
          message: { first: 'value' },
          contextCorrelationId: agentContext.contextCorrelationId,
        },
      })
      expect(eventEmitter.emit).toHaveBeenNthCalledWith(2, agentContext, {
        type: AgentEventTypes.AgentMessageReceived,
        payload: {
          message: { second: 'value' },
          contextCorrelationId: agentContext.contextCorrelationId,
        },
      })
    })
  })
})
