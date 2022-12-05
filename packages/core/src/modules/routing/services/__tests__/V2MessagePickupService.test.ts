import type { EncryptedMessage } from '../../../../didcomm/types'
import type { MessageRepository } from '../../../../storage/MessageRepository'

import { getAgentConfig, getAgentContext, getMockConnection, mockFunction } from '../../../../../tests/helpers'
import { Dispatcher } from '../../../../agent/Dispatcher'
import { EventEmitter } from '../../../../agent/EventEmitter'
import { AgentEventTypes } from '../../../../agent/Events'
import { MessageSender } from '../../../../agent/MessageSender'
import { InboundMessageContext } from '../../../../agent/models/InboundMessageContext'
import { Attachment } from '../../../../decorators/attachment/v1/Attachment'
import { AriesFrameworkError } from '../../../../error'
import { InMemoryMessageRepository } from '../../../../storage/InMemoryMessageRepository'
import { uuid } from '../../../../utils/uuid'
import { ConnectionRepository, ConnectionService, DidExchangeState } from '../../../connections'
import { DidRepository } from '../../../dids/repository/DidRepository'
import { DidRegistrarService } from '../../../dids/services/DidRegistrarService'
import { RecipientModuleConfig } from '../../RecipientModuleConfig'
import {
  DeliveryRequestMessage,
  MessageDeliveryMessage,
  MessagesReceivedMessage,
  StatusMessage,
  StatusRequestMessage,
  V2MessagePickupService,
} from '../../protocol'

const mockConnection = getMockConnection({
  state: DidExchangeState.Completed,
})

// Mock classes
jest.mock('../MediationRecipientService')
jest.mock('../../../../storage/InMemoryMessageRepository')
jest.mock('../../../../agent/Dispatcher')
jest.mock('../../../../agent/EventEmitter')
jest.mock('../../../connections/repository/ConnectionRepository')
jest.mock('../../../dids/repository/DidRepository')
jest.mock('../../../dids/services/DidRegistrarService')
jest.mock('../../../../agent/MessageSender')

// Mock typed object
const DispatcherMock = Dispatcher as jest.Mock<Dispatcher>
const InMessageRepositoryMock = InMemoryMessageRepository as jest.Mock<InMemoryMessageRepository>
const EventEmitterMock = EventEmitter as jest.Mock<EventEmitter>
const ConnectionRepositoryMock = ConnectionRepository as jest.Mock<ConnectionRepository>
const DidRepositoryMock = DidRepository as jest.Mock<DidRepository>
const DidRegistrarServiceMock = DidRegistrarService as jest.Mock<DidRegistrarService>
const MessageSenderMock = MessageSender as jest.Mock<MessageSender>

const agentContext = getAgentContext()

const encryptedMessage: EncryptedMessage = {
  recipients: [],
  protected: 'base64url',
  iv: 'base64url',
  ciphertext: 'base64url',
  tag: 'base64url',
}
const queuedMessages = [encryptedMessage, encryptedMessage, encryptedMessage]

const connectionImageUrl = 'https://example.com/image.png'

describe('V2MessagePickupService', () => {
  let pickupService: V2MessagePickupService
  let messageRepository: MessageRepository
  let dispatcher: Dispatcher
  let eventEmitter: EventEmitter

  const config = getAgentConfig('V2MessagePickupService', {
    endpoints: ['http://agent.com:8080'],
    connectionImageUrl,
  })

  beforeEach(async () => {
    dispatcher = new DispatcherMock()
    eventEmitter = new EventEmitterMock()
    const messageSender = new MessageSenderMock()
    const connectionRepository = new ConnectionRepositoryMock()
    const didRepository = new DidRepositoryMock()
    const didRegistrarService = new DidRegistrarServiceMock()

    const connectionService = new ConnectionService(
      config.logger,
      connectionRepository,
      didRepository,
      didRegistrarService,
      eventEmitter
    )

    messageRepository = new InMessageRepositoryMock()
    pickupService = new V2MessagePickupService(
      messageRepository,
      eventEmitter,
      dispatcher,
      connectionService,
      messageSender,
      new RecipientModuleConfig()
    )
  })

  describe('processStatusRequest', () => {
    test('no available messages in queue', async () => {
      mockFunction(messageRepository.getAvailableMessageCount).mockResolvedValue(0)

      const statusRequest = new StatusRequestMessage({})

      const messageContext = new InboundMessageContext(statusRequest, { connection: mockConnection, agentContext })

      const { connection, message } = await pickupService.processStatusRequest(messageContext)

      expect(connection).toEqual(mockConnection)
      expect(message).toEqual(
        new StatusMessage({
          id: message.id,
          threadId: statusRequest.threadId,
          messageCount: 0,
        })
      )
      expect(messageRepository.getAvailableMessageCount).toHaveBeenCalledWith(mockConnection.id)
    })

    test('multiple messages in queue', async () => {
      mockFunction(messageRepository.getAvailableMessageCount).mockResolvedValue(5)
      const statusRequest = new StatusRequestMessage({})

      const messageContext = new InboundMessageContext(statusRequest, { connection: mockConnection, agentContext })

      const { connection, message } = await pickupService.processStatusRequest(messageContext)

      expect(connection).toEqual(mockConnection)
      expect(message).toEqual(
        new StatusMessage({
          id: message.id,
          threadId: statusRequest.threadId,
          messageCount: 5,
        })
      )
      expect(messageRepository.getAvailableMessageCount).toHaveBeenCalledWith(mockConnection.id)
    })

    test('status request specifying recipient key', async () => {
      mockFunction(messageRepository.getAvailableMessageCount).mockResolvedValue(10)

      const statusRequest = new StatusRequestMessage({
        recipientKey: 'recipientKey',
      })

      const messageContext = new InboundMessageContext(statusRequest, { connection: mockConnection, agentContext })

      await expect(pickupService.processStatusRequest(messageContext)).rejects.toThrowError(
        'recipient_key parameter not supported'
      )
    })
  })

  describe('processDeliveryRequest', () => {
    test('no available messages in queue', async () => {
      mockFunction(messageRepository.takeFromQueue).mockResolvedValue([])

      const deliveryRequest = new DeliveryRequestMessage({ limit: 10 })

      const messageContext = new InboundMessageContext(deliveryRequest, { connection: mockConnection, agentContext })

      const { connection, message } = await pickupService.processDeliveryRequest(messageContext)

      expect(connection).toEqual(mockConnection)
      expect(message).toEqual(
        new StatusMessage({
          id: message.id,
          threadId: deliveryRequest.threadId,
          messageCount: 0,
        })
      )
      expect(messageRepository.takeFromQueue).toHaveBeenCalledWith(mockConnection.id, 10, true)
    })

    test('less messages in queue than limit', async () => {
      mockFunction(messageRepository.takeFromQueue).mockResolvedValue(queuedMessages)

      const deliveryRequest = new DeliveryRequestMessage({ limit: 10 })

      const messageContext = new InboundMessageContext(deliveryRequest, { connection: mockConnection, agentContext })

      const { connection, message } = await pickupService.processDeliveryRequest(messageContext)

      expect(connection).toEqual(mockConnection)
      expect(message).toBeInstanceOf(MessageDeliveryMessage)
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
      mockFunction(messageRepository.takeFromQueue).mockResolvedValue(queuedMessages.slice(0, 2))

      const deliveryRequest = new DeliveryRequestMessage({ limit: 2 })

      const messageContext = new InboundMessageContext(deliveryRequest, { connection: mockConnection, agentContext })

      const { connection, message } = await pickupService.processDeliveryRequest(messageContext)

      expect(connection).toEqual(mockConnection)
      expect(message).toBeInstanceOf(MessageDeliveryMessage)
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
      mockFunction(messageRepository.takeFromQueue).mockResolvedValue(queuedMessages)

      const statusRequest = new DeliveryRequestMessage({
        limit: 10,
        recipientKey: 'recipientKey',
      })

      const messageContext = new InboundMessageContext(statusRequest, { connection: mockConnection, agentContext })

      await expect(pickupService.processStatusRequest(messageContext)).rejects.toThrowError(
        'recipient_key parameter not supported'
      )
    })
  })

  describe('processMessagesReceived', () => {
    test('messages received partially', async () => {
      mockFunction(messageRepository.takeFromQueue).mockResolvedValue(queuedMessages)
      mockFunction(messageRepository.getAvailableMessageCount).mockResolvedValue(4)

      const messagesReceived = new MessagesReceivedMessage({
        messageIdList: ['1', '2'],
      })

      const messageContext = new InboundMessageContext(messagesReceived, { connection: mockConnection, agentContext })

      const { connection, message } = await pickupService.processMessagesReceived(messageContext)

      expect(connection).toEqual(mockConnection)
      expect(message).toEqual(
        new StatusMessage({
          id: message.id,
          threadId: messagesReceived.threadId,
          messageCount: 4,
        })
      )
      expect(messageRepository.getAvailableMessageCount).toHaveBeenCalledWith(mockConnection.id)
      expect(messageRepository.takeFromQueue).toHaveBeenCalledWith(mockConnection.id, 2)
    })

    test('all messages have been received', async () => {
      mockFunction(messageRepository.takeFromQueue).mockResolvedValue(queuedMessages)
      mockFunction(messageRepository.getAvailableMessageCount).mockResolvedValue(0)

      const messagesReceived = new MessagesReceivedMessage({
        messageIdList: ['1', '2'],
      })

      const messageContext = new InboundMessageContext(messagesReceived, { connection: mockConnection, agentContext })

      const { connection, message } = await pickupService.processMessagesReceived(messageContext)

      expect(connection).toEqual(mockConnection)
      expect(message).toEqual(
        new StatusMessage({
          id: message.id,
          threadId: messagesReceived.threadId,
          messageCount: 0,
        })
      )

      expect(messageRepository.getAvailableMessageCount).toHaveBeenCalledWith(mockConnection.id)
      expect(messageRepository.takeFromQueue).toHaveBeenCalledWith(mockConnection.id, 2)
    })
  })

  describe('processDelivery', () => {
    it('if the delivery has no attachments expect an error', async () => {
      const messageContext = new InboundMessageContext({} as MessageDeliveryMessage, {
        connection: mockConnection,
        agentContext,
      })

      await expect(pickupService.processDelivery(messageContext)).rejects.toThrowError(
        new AriesFrameworkError('Error processing attachments')
      )
    })

    it('should return a message received with an message id list in it', async () => {
      const messageDeliveryMessage = new MessageDeliveryMessage({
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

      const messagesReceivedMessage = await pickupService.processDelivery(messageContext)

      expect(messagesReceivedMessage).toEqual(
        new MessagesReceivedMessage({
          id: messagesReceivedMessage.id,
          messageIdList: ['1'],
        })
      )
    })

    it('calls the event emitter for each message', async () => {
      const messageDeliveryMessage = new MessageDeliveryMessage({
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

      await pickupService.processDelivery(messageContext)

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
