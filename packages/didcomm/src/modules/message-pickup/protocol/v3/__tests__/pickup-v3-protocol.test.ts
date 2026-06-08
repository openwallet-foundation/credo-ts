import { JsonEncoder } from '@credo-ts/core'
import type { MockedClassConstructor } from '../../../../../../../../tests/types'
import { EventEmitter } from '../../../../../../../core/src/agent/EventEmitter'
import { uuid } from '../../../../../../../core/src/utils/uuid'
import { getAgentContext, getMockConnection, mockFunction } from '../../../../../../../core/tests/helpers'
import { DidCommMessageSender } from '../../../../../DidCommMessageSender'
import { DidCommModuleConfig } from '../../../../../DidCommModuleConfig'
import { DidCommAttachment } from '../../../../../decorators/attachment/DidCommAttachment'
import { DidCommProblemReportError } from '../../../../../errors/problem-reports/DidCommProblemReportError'
import { DidCommInboundMessageContext } from '../../../../../models'
import { InMemoryQueueTransportRepository } from '../../../../../transport/queue/InMemoryQueueTransportRepository'
import type { DidCommEncryptedMessage } from '../../../../../types'
import { DidCommConnectionService, DidCommDidExchangeState, DidCommTrustPingMessage } from '../../../../connections'
import { DidCommMessagePickupModuleConfig } from '../../../DidCommMessagePickupModuleConfig'
import { DidCommMessagePickupSessionService } from '../../../services/DidCommMessagePickupSessionService'
import { DidCommMessagePickupV1Protocol } from '../../v1'
import { DidCommMessagePickupV2Protocol } from '../../v2'
import { DidCommMessagePickupV3Protocol } from '../DidCommMessagePickupV3Protocol'
import {
  DidCommDeliveryRequestV3Message,
  DidCommLiveDeliveryChangeV3Message,
  DidCommMessageDeliveryV3Message,
  DidCommMessagesReceivedV3Message,
  DidCommStatusRequestV3Message,
  DidCommStatusV3Message,
} from '../messages'

const mockConnection = getMockConnection({
  state: DidCommDidExchangeState.Completed,
})
mockConnection.didcommVersion = 'v2'

// Mock classes
vi.mock('../../../../../transport/queue/InMemoryQueueTransportRepository')
vi.mock('../../../../../../../core/src/agent/EventEmitter')
vi.mock('../../../../../DidCommMessageSender')
vi.mock('../../../../connections/services/DidCommConnectionService')

// Mock typed object
const InMessageRepositoryMock = InMemoryQueueTransportRepository as MockedClassConstructor<
  typeof InMemoryQueueTransportRepository
>
const EventEmitterMock = EventEmitter as MockedClassConstructor<typeof EventEmitter>
const MessageSenderMock = DidCommMessageSender as MockedClassConstructor<typeof DidCommMessageSender>
const ConnectionServiceMock = DidCommConnectionService as MockedClassConstructor<typeof DidCommConnectionService>

const queueTransportRepository = new InMessageRepositoryMock()

const didCommModuleConfig = new DidCommModuleConfig({ queueTransportRepository })
const messagePickupModuleConfig = new DidCommMessagePickupModuleConfig({
  maximumBatchSize: 10,
  protocols: [
    new DidCommMessagePickupV1Protocol(),
    new DidCommMessagePickupV2Protocol(),
    new DidCommMessagePickupV3Protocol(),
  ],
})
const messageSender = new MessageSenderMock()
const eventEmitter = new EventEmitterMock()
const connectionService = new ConnectionServiceMock()

const messagePickupSessionService = new DidCommMessagePickupSessionService()

const agentContext = getAgentContext({
  registerInstances: [
    [EventEmitter, eventEmitter],
    [DidCommMessageSender, messageSender],
    [DidCommConnectionService, connectionService],
    [DidCommModuleConfig, didCommModuleConfig],
    [DidCommMessagePickupModuleConfig, messagePickupModuleConfig],
    [DidCommMessagePickupSessionService, messagePickupSessionService],
  ],
})

const encryptedMessage: DidCommEncryptedMessage = {
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

describe('DidCommMessagePickupV3Protocol', () => {
  let pickupProtocol: DidCommMessagePickupV3Protocol

  beforeEach(async () => {
    pickupProtocol = new DidCommMessagePickupV3Protocol()
  })

  describe('processStatusRequest', () => {
    test('no available messages in queue', async () => {
      mockFunction(queueTransportRepository.getAvailableMessageCount).mockResolvedValue(0)

      const statusRequest = new DidCommStatusRequestV3Message({})

      const messageContext = new DidCommInboundMessageContext(statusRequest, {
        connection: mockConnection,
        agentContext,
      })

      const result = await pickupProtocol.processStatusRequest(messageContext)
      if (!result) throw new Error('Expected processStatusRequest result to be defined')
      const { connection, message } = result

      expect(connection).toEqual(mockConnection)
      expect(message).toEqual(
        new DidCommStatusV3Message({
          id: message.id,
          threadId: statusRequest.threadId,
          messageCount: 0,
        })
      )
      expect(queueTransportRepository.getAvailableMessageCount).toHaveBeenCalledWith(
        agentContext,
        expect.objectContaining({ connectionId: mockConnection.id })
      )
    })

    test('multiple messages in queue', async () => {
      mockFunction(queueTransportRepository.getAvailableMessageCount).mockResolvedValue(5)
      const statusRequest = new DidCommStatusRequestV3Message({})

      const messageContext = new DidCommInboundMessageContext(statusRequest, {
        connection: mockConnection,
        agentContext,
      })

      const result = await pickupProtocol.processStatusRequest(messageContext)
      if (!result) throw new Error('Expected processStatusRequest result to be defined')
      const { connection, message } = result

      expect(connection).toEqual(mockConnection)
      expect(message).toEqual(
        new DidCommStatusV3Message({
          id: message.id,
          threadId: statusRequest.threadId,
          messageCount: 5,
        })
      )
      expect(queueTransportRepository.getAvailableMessageCount).toHaveBeenCalledWith(
        agentContext,
        expect.objectContaining({ connectionId: mockConnection.id })
      )
    })

    test('status request specifying recipient_did', async () => {
      mockFunction(queueTransportRepository.getAvailableMessageCount).mockResolvedValue(10)

      const statusRequest = new DidCommStatusRequestV3Message({
        recipientDid: 'did:peer:2.Ez6LSbysY2xFMRpGMhb7tFTLMpeuPRaqaWM1yECx2AtzE3KCc',
      })

      const messageContext = new DidCommInboundMessageContext(statusRequest, {
        connection: mockConnection,
        agentContext,
      })

      await pickupProtocol.processStatusRequest(messageContext)
      expect(queueTransportRepository.getAvailableMessageCount).toHaveBeenCalledWith(agentContext, {
        connectionId: mockConnection.id,
        recipientDid: 'did:peer:2.Ez6LSbysY2xFMRpGMhb7tFTLMpeuPRaqaWM1yECx2AtzE3KCc',
      })
    })
  })

  describe('processDeliveryRequest', () => {
    test('no available messages in queue', async () => {
      mockFunction(queueTransportRepository.takeFromQueue).mockReturnValue([])

      const deliveryRequest = new DidCommDeliveryRequestV3Message({ limit: 10 })

      const messageContext = new DidCommInboundMessageContext(deliveryRequest, {
        connection: mockConnection,
        agentContext,
      })

      const { connection, message } = await pickupProtocol.processDeliveryRequest(messageContext)

      expect(connection).toEqual(mockConnection)
      expect(message).toEqual(
        new DidCommStatusV3Message({
          id: message.id,
          threadId: deliveryRequest.threadId,
          messageCount: 0,
        })
      )
      expect(queueTransportRepository.takeFromQueue).toHaveBeenCalledWith(
        agentContext,
        expect.objectContaining({ connectionId: mockConnection.id, limit: 10 })
      )
    })

    test('less messages in queue than limit', async () => {
      mockFunction(queueTransportRepository.takeFromQueue).mockReturnValue(queuedMessages)

      const deliveryRequest = new DidCommDeliveryRequestV3Message({ limit: 10 })

      const messageContext = new DidCommInboundMessageContext(deliveryRequest, {
        connection: mockConnection,
        agentContext,
      })

      const { connection, message } = await pickupProtocol.processDeliveryRequest(messageContext)

      expect(connection).toEqual(mockConnection)
      expect(message).toBeInstanceOf(DidCommMessageDeliveryV3Message)
      expect(message.threadId).toEqual(deliveryRequest.threadId)
      expect(message.appendedAttachments?.length).toEqual(3)
      expect(message.appendedAttachments).toEqual(
        expect.arrayContaining(
          queuedMessages.map((msg) =>
            expect.objectContaining({
              id: msg.id,
              data: expect.objectContaining({
                base64: expect.any(String),
              }),
            })
          )
        )
      )
      expect(queueTransportRepository.takeFromQueue).toHaveBeenCalledWith(
        agentContext,
        expect.objectContaining({ connectionId: mockConnection.id, limit: 10 })
      )
    })

    test('delivery request specifying recipient_did', async () => {
      mockFunction(queueTransportRepository.takeFromQueue).mockReturnValue(queuedMessages)

      const deliveryRequest = new DidCommDeliveryRequestV3Message({
        limit: 10,
        recipientDid: 'did:peer:2.Ez6LSbysY2xFMRpGMhb7tFTLMpeuPRaqaWM1yECx2AtzE3KCc',
      })

      const messageContext = new DidCommInboundMessageContext(deliveryRequest, {
        connection: mockConnection,
        agentContext,
      })

      await pickupProtocol.processDeliveryRequest(messageContext)

      expect(queueTransportRepository.takeFromQueue).toHaveBeenCalledWith(agentContext, {
        connectionId: mockConnection.id,
        limit: 10,
        recipientDid: 'did:peer:2.Ez6LSbysY2xFMRpGMhb7tFTLMpeuPRaqaWM1yECx2AtzE3KCc',
      })
    })
  })

  describe('processMessagesReceived', () => {
    test('messages received partially', async () => {
      mockFunction(queueTransportRepository.takeFromQueue).mockReturnValue(queuedMessages)
      mockFunction(queueTransportRepository.getAvailableMessageCount).mockResolvedValue(4)

      const messagesReceived = new DidCommMessagesReceivedV3Message({
        messageIdList: ['1', '2'],
      })

      const messageContext = new DidCommInboundMessageContext(messagesReceived, {
        connection: mockConnection,
        agentContext,
      })

      const { connection, message } = await pickupProtocol.processMessagesReceived(messageContext)

      expect(connection).toEqual(mockConnection)
      expect(message).toEqual(
        new DidCommStatusV3Message({
          id: message.id,
          threadId: messagesReceived.threadId,
          messageCount: 4,
        })
      )
      expect(queueTransportRepository.getAvailableMessageCount).toHaveBeenCalledWith(
        agentContext,
        expect.objectContaining({ connectionId: mockConnection.id })
      )
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
        recipientDid: 'did:peer:2.Ez6LSbysY2xFMRpGMhb7tFTLMpeuPRaqaWM1yECx2AtzE3KCc',
      })

      expect(statusRequestMessage).toMatchObject({
        id: expect.any(String),
        recipientDid: 'did:peer:2.Ez6LSbysY2xFMRpGMhb7tFTLMpeuPRaqaWM1yECx2AtzE3KCc',
      })
    })
  })

  describe('processStatus', () => {
    it('if status request has a message count of zero returns nothing', async () => {
      const status = new DidCommStatusV3Message({
        threadId: uuid(),
        messageCount: 0,
      })

      mockFunction(connectionService.createTrustPing).mockResolvedValueOnce({
        message: new DidCommTrustPingMessage({}),
        connectionRecord: mockConnection,
      })

      const messageContext = new DidCommInboundMessageContext(status, { connection: mockConnection, agentContext })
      const deliveryRequestMessage = await pickupProtocol.processStatus(messageContext)
      expect(deliveryRequestMessage).toBeNull()
    })

    it('if it has a message count greater than zero return a valid delivery request', async () => {
      const status = new DidCommStatusV3Message({
        threadId: uuid(),
        messageCount: 1,
      })
      const messageContext = new DidCommInboundMessageContext(status, { connection: mockConnection, agentContext })

      const deliveryRequestMessage = await pickupProtocol.processStatus(messageContext)
      expect(deliveryRequestMessage)
      expect(deliveryRequestMessage).toEqual(
        new DidCommDeliveryRequestV3Message({ id: deliveryRequestMessage?.id, limit: 1 })
      )
    })
  })

  describe('processDelivery', () => {
    it('if the delivery has no attachments expect an error', async () => {
      const messageContext = new DidCommInboundMessageContext({} as DidCommMessageDeliveryV3Message, {
        connection: mockConnection,
        agentContext,
      })

      await expect(pickupProtocol.processDelivery(messageContext)).rejects.toThrowError(DidCommProblemReportError)
    })

    it('should return a message received with a message id list in it', async () => {
      const messageDeliveryMessage = new DidCommMessageDeliveryV3Message({
        threadId: uuid(),
        attachments: [
          new DidCommAttachment({
            id: '1',
            data: {
              json: { protected: 'p', iv: 'i', ciphertext: 'c', tag: 't' },
            },
          }),
        ],
      })
      const messageContext = new DidCommInboundMessageContext(messageDeliveryMessage, {
        connection: mockConnection,
        agentContext,
      })

      const messagesReceivedMessage = await pickupProtocol.processDelivery(messageContext)

      expect(messagesReceivedMessage).toEqual(
        new DidCommMessagesReceivedV3Message({
          id: messagesReceivedMessage.id,
          messageIdList: ['1'],
        })
      )
    })

    it('handles base64 attachments per Message Pickup 3.0 spec', async () => {
      const encryptedMsg = { protected: 'p', iv: 'i', ciphertext: 'c', tag: 't' }
      const messageDeliveryMessage = new DidCommMessageDeliveryV3Message({
        threadId: uuid(),
        attachments: [
          new DidCommAttachment({
            id: '1',
            data: {
              base64: JsonEncoder.toBase64(encryptedMsg),
            },
          }),
        ],
      })
      const messageContext = new DidCommInboundMessageContext(messageDeliveryMessage, {
        connection: mockConnection,
        agentContext,
      })

      const messagesReceivedMessage = await pickupProtocol.processDelivery(messageContext)

      expect(messagesReceivedMessage.messageIdList).toEqual(['1'])
    })
  })

  describe('processLiveDeliveryChange', () => {
    test('throws problem report when live_delivery is true but no sessionId (non-persistent transport)', async () => {
      const liveDeliveryChange = new DidCommLiveDeliveryChangeV3Message({ liveDelivery: true })

      const messageContext = new DidCommInboundMessageContext(liveDeliveryChange, {
        connection: mockConnection,
        agentContext,
        sessionId: undefined,
      })

      await expect(pickupProtocol.processLiveDeliveryChange(messageContext)).rejects.toThrowError(
        DidCommProblemReportError
      )
      await expect(pickupProtocol.processLiveDeliveryChange(messageContext)).rejects.toThrow(
        'Connection does not support Live Delivery'
      )
    })

    test('saves live session when live_delivery is true and sessionId is present', async () => {
      mockFunction(queueTransportRepository.getAvailableMessageCount).mockResolvedValue(3)

      const liveDeliveryChange = new DidCommLiveDeliveryChangeV3Message({ liveDelivery: true })

      const messageContext = new DidCommInboundMessageContext(liveDeliveryChange, {
        connection: mockConnection,
        agentContext,
        sessionId: 'test-session-id',
      })

      const { message } = await pickupProtocol.processLiveDeliveryChange(messageContext)

      expect(message).toBeInstanceOf(DidCommStatusV3Message)
      expect((message as DidCommStatusV3Message).liveDelivery).toBe(true)
      expect((message as DidCommStatusV3Message).messageCount).toBe(3)
    })

    test('removes live session when live_delivery is false', async () => {
      mockFunction(queueTransportRepository.getAvailableMessageCount).mockResolvedValue(0)

      const liveDeliveryChange = new DidCommLiveDeliveryChangeV3Message({ liveDelivery: false })

      const messageContext = new DidCommInboundMessageContext(liveDeliveryChange, {
        connection: mockConnection,
        agentContext,
      })

      const { message } = await pickupProtocol.processLiveDeliveryChange(messageContext)

      expect(message).toBeInstanceOf(DidCommStatusV3Message)
      expect((message as DidCommStatusV3Message).liveDelivery).toBe(false)
      expect((message as DidCommStatusV3Message).messageCount).toBe(0)
    })
  })
})
