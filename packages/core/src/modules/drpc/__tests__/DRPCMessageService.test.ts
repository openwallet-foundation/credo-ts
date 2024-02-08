import { getAgentContext, getMockConnection } from '../../../../tests/helpers'
import { EventEmitter } from '../../../agent/EventEmitter'
import { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import { DRPCMessageRole } from '../DRPCMessageRole'
import { DRPCRequestMessage, DRPCResponseMessage, DRPCRequestObject, DRPCResponseObject } from '../messages'
import { DRPCMessageRecord } from '../repository/DRPCMessageRecord'
import { DRPCMessageRepository } from '../repository/DRPCMessageRepository'
import { DRPCMessageService } from '../services'

jest.mock('../repository/DRPCMessageRepository')
const DRPCMessageRepositoryMock = DRPCMessageRepository as jest.Mock<DRPCMessageRepository>
const drpcMessageRepository = new DRPCMessageRepositoryMock()

jest.mock('../../../agent/EventEmitter')
const EventEmitterMock = EventEmitter as jest.Mock<EventEmitter>
const eventEmitter = new EventEmitterMock()

const agentContext = getAgentContext()

describe('DRPCMessageService', () => {
  let drpcMessageService: DRPCMessageService
  const mockConnectionRecord = getMockConnection({
    id: 'd3849ac3-c981-455b-a1aa-a10bea6cead8',
    did: 'did:sov:C2SsBf5QUQpqSAQfhu3sd2',
  })

  beforeEach(() => {
    drpcMessageService = new DRPCMessageService(drpcMessageRepository, eventEmitter)
  })

  describe('createMessage', () => {
    it(`creates message and record, and emits message and basic message record`, async () => {
      const messageRequest: DRPCRequestObject = {
        jsonrpc: '2.0',
        method: 'hello',
        id: 1,
      }
      const { message } = await drpcMessageService.createMessage(agentContext, messageRequest, mockConnectionRecord)

      expect(message).toBeInstanceOf(DRPCRequestMessage)
      expect((message as DRPCRequestMessage).request.method).toBe('hello')

      expect(drpcMessageRepository.save).toHaveBeenCalledWith(agentContext, expect.any(DRPCMessageRecord))
      expect(eventEmitter.emit).toHaveBeenCalledWith(agentContext, {
        type: 'DRPCMessageStateChanged',
        payload: {
          drpcMessageRecord: expect.objectContaining({
            connectionId: mockConnectionRecord.id,
            id: expect.any(String),
            sentTime: expect.any(String),
            content: 'hello',
            role: DRPCMessageRole.Sender,
          }),
          message,
        },
      })
    })
  })

  describe('save', () => {
    it(`stores record and emits message and basic message record`, async () => {
      const drpcMessage = new DRPCRequestMessage({request: {jsonrpc: '2.0', method: 'hello', id: 1}})

      const messageContext = new InboundMessageContext(drpcMessage, { agentContext })

      await drpcMessageService.save(messageContext, mockConnectionRecord)

      expect(drpcMessageRepository.save).toHaveBeenCalledWith(agentContext, expect.any(DRPCMessageRecord))
      expect(eventEmitter.emit).toHaveBeenCalledWith(agentContext, {
        type: 'DRPCMessageStateChanged',
        payload: {
          drpcMessageRecord: expect.objectContaining({
            connectionId: mockConnectionRecord.id,
            id: expect.any(String),
            content: drpcMessage.request,
            role: DRPCMessageRole.Receiver,
          }),
          message: messageContext.message,
        },
      })
    })
  })
})
