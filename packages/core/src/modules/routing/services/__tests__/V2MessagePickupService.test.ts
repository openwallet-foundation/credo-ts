import type { MessageRepository } from '../../../../storage/MessageRepository'
import type { EncryptedMessage } from '../../../../types'

import { getAgentContext, getMockConnection, mockFunction } from '../../../../../tests/helpers'
import { MessageHandlerRegistry } from '../../../../agent/MessageHandlerRegistry'
import { InboundMessageContext } from '../../../../agent/models/InboundMessageContext'
import { InMemoryMessageRepository } from '../../../../storage/InMemoryMessageRepository'
import { DidExchangeState } from '../../../connections'
import {
  DeliveryRequestMessage,
  MessageDeliveryMessage,
  MessagesReceivedMessage,
  StatusMessage,
  StatusRequestMessage,
  V2MessagePickupService,
} from '../../protocol'
import { MediationRecipientService } from '../MediationRecipientService'

const mockConnection = getMockConnection({
  state: DidExchangeState.Completed,
})

// Mock classes
jest.mock('../MediationRecipientService')
jest.mock('../../../../storage/InMemoryMessageRepository')
jest.mock('../../../../agent/MessageHandlerRegistry')

// Mock typed object
const MediationRecipientServiceMock = MediationRecipientService as jest.Mock<MediationRecipientService>
const MessageHandlerRegistryMock = MessageHandlerRegistry as jest.Mock<MessageHandlerRegistry>
const InMessageRepositoryMock = InMemoryMessageRepository as jest.Mock<InMemoryMessageRepository>

const agentContext = getAgentContext()

const encryptedMessage: EncryptedMessage = {
  protected: 'base64url',
  iv: 'base64url',
  ciphertext: 'base64url',
  tag: 'base64url',
}
const queuedMessages = [encryptedMessage, encryptedMessage, encryptedMessage]

describe('V2MessagePickupService', () => {
  let pickupService: V2MessagePickupService
  let messageRepository: MessageRepository

  beforeEach(async () => {
    const messageHandlerRegistry = new MessageHandlerRegistryMock()
    const mediationRecipientService = new MediationRecipientServiceMock()

    messageRepository = new InMessageRepositoryMock()
    pickupService = new V2MessagePickupService(messageRepository, messageHandlerRegistry, mediationRecipientService)
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
})
