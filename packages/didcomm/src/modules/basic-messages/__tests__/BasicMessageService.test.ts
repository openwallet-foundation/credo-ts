import type { MockedClassConstructor } from '../../../../../../tests/types'
import { EventEmitter } from '../../../../../core/src/agent/EventEmitter'
import { getAgentContext, getMockConnection } from '../../../../../core/tests/helpers'
import { DidCommInboundMessageContext } from '../../../models'
import { DidCommBasicMessageRole } from '../DidCommBasicMessageRole'
import { DidCommBasicMessage } from '../messages'
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
})
