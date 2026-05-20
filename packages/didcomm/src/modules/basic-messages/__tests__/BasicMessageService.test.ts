import type { MockedClassConstructor } from '../../../../../../tests/types'
import { EventEmitter } from '../../../../../core/src/agent/EventEmitter'
import { getAgentContext, getMockConnection } from '../../../../../core/tests/helpers'
import { DidCommInboundMessageContext } from '../../../models'
import { DidCommBasicMessageRole } from '../DidCommBasicMessageRole'
import { DidCommBasicMessage } from '../protocol/v1'
import { DidCommBasicMessageV2 } from '../protocol/v2'
import { DidCommBasicMessageRecord } from '../repository/DidCommBasicMessageRecord'
import { DidCommBasicMessageRepository } from '../repository/DidCommBasicMessageRepository'
import { DidCommBasicMessageService } from '../services'

vi.mock('../repository/DidCommBasicMessageRepository')
const BasicMessageRepositoryMock = DidCommBasicMessageRepository as MockedClassConstructor<
  typeof DidCommBasicMessageRepository
>
const basicMessageRepository = new BasicMessageRepositoryMock()

vi.mock('../../../../../core/src/agent/EventEmitter')
const EventEmitterMock = EventEmitter as MockedClassConstructor<typeof EventEmitter>
const eventEmitter = new EventEmitterMock()

const agentContext = getAgentContext()

describe('BasicMessageService', () => {
  let basicMessageService: DidCommBasicMessageService
  const mockConnectionRecord = getMockConnection({
    id: 'd3849ac3-c981-455b-a1aa-a10bea6cead8',
    did: 'did:sov:C2SsBf5QUQpqSAQfhu3sd2',
  })

  beforeEach(() => {
    basicMessageService = new DidCommBasicMessageService(basicMessageRepository, eventEmitter)
  })

  describe('createMessage', () => {
    it('creates message and record, and emits message and basic message record', async () => {
      const { message } = await basicMessageService.createMessage(agentContext, 'hello', mockConnectionRecord)

      expect(message.content).toBe('hello')

      expect(basicMessageRepository.save).toHaveBeenCalledWith(agentContext, expect.any(DidCommBasicMessageRecord))
      expect(eventEmitter.emit).toHaveBeenCalledWith(agentContext, {
        type: 'DidCommBasicMessageStateChanged',
        payload: {
          basicMessageRecord: expect.objectContaining({
            connectionId: mockConnectionRecord.id,
            id: expect.any(String),
            sentTime: expect.any(String),
            content: 'hello',
            role: DidCommBasicMessageRole.Sender,
          }),
          message,
        },
      })
    })
  })

  describe('save', () => {
    it('stores record and emits message and basic message record', async () => {
      const basicMessage = new DidCommBasicMessage({
        id: '123',
        content: 'message',
      })

      const messageContext = new DidCommInboundMessageContext(basicMessage, { agentContext })

      await basicMessageService.save(messageContext, mockConnectionRecord)

      expect(basicMessageRepository.save).toHaveBeenCalledWith(agentContext, expect.any(DidCommBasicMessageRecord))
      expect(eventEmitter.emit).toHaveBeenCalledWith(agentContext, {
        type: 'DidCommBasicMessageStateChanged',
        payload: {
          basicMessageRecord: expect.objectContaining({
            connectionId: mockConnectionRecord.id,
            id: expect.any(String),
            sentTime: basicMessage.sentTime.toISOString(),
            content: basicMessage.content,
            role: DidCommBasicMessageRole.Receiver,
          }),
          message: messageContext.message,
        },
      })
    })
  })

  describe('createMessageV2', () => {
    it('creates v2 message and record with protocolVersion 2.0', async () => {
      const { message, record } = await basicMessageService.createMessageV2(
        agentContext,
        'hello v2',
        mockConnectionRecord
      )

      expect(message).toBeInstanceOf(DidCommBasicMessageV2)
      expect(message.content).toBe('hello v2')
      expect(record.protocolVersion).toBe('v2')

      expect(basicMessageRepository.save).toHaveBeenCalledWith(agentContext, expect.any(DidCommBasicMessageRecord))
      expect(eventEmitter.emit).toHaveBeenCalledWith(agentContext, {
        type: 'DidCommBasicMessageV2StateChanged',
        payload: {
          basicMessageRecord: expect.objectContaining({
            connectionId: mockConnectionRecord.id,
            content: 'hello v2',
            role: DidCommBasicMessageRole.Sender,
            protocolVersion: 'v2',
          }),
          message: expect.any(DidCommBasicMessageV2),
        },
      })
    })

    it('creates v2 message with parentThreadId', async () => {
      const { message, record } = await basicMessageService.createMessageV2(
        agentContext,
        'reply',
        mockConnectionRecord,
        'parent-thread-id'
      )

      expect(message.thread?.parentThreadId).toBe('parent-thread-id')
      expect(record.parentThreadId).toBe('parent-thread-id')
    })
  })

  describe('saveV2', () => {
    it('stores v2 record and emits DidCommBasicMessageV2StateChanged', async () => {
      const basicMessageV2 = new DidCommBasicMessageV2({
        id: '123',
        content: 'message v2',
        createdTime: Math.floor(Date.now() / 1000),
      })

      const messageContext = new DidCommInboundMessageContext(basicMessageV2, { agentContext })

      vi.mocked(basicMessageRepository.save).mockClear()

      await basicMessageService.saveV2(messageContext, mockConnectionRecord)

      expect(basicMessageRepository.save).toHaveBeenCalledTimes(1)
      const savedRecord = vi.mocked(basicMessageRepository.save).mock.calls[0][1]
      expect(savedRecord.protocolVersion).toBe('v2')
      expect(savedRecord.content).toBe('message v2')
      expect(savedRecord.role).toBe(DidCommBasicMessageRole.Receiver)

      expect(eventEmitter.emit).toHaveBeenCalledWith(agentContext, {
        type: 'DidCommBasicMessageV2StateChanged',
        payload: {
          basicMessageRecord: expect.objectContaining({
            connectionId: mockConnectionRecord.id,
            content: 'message v2',
            role: DidCommBasicMessageRole.Receiver,
            protocolVersion: 'v2',
          }),
          message: messageContext.message,
        },
      })
    })
  })
})
