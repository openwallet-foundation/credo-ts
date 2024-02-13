import type { DrpcRequestObject } from '../messages'

import { EventEmitter } from '../../../core/src/agent/EventEmitter'
import { InboundMessageContext } from '../../../core/src/agent/models/InboundMessageContext'
import { getAgentContext, getMockConnection } from '../../../core/tests/helpers'
import { DrpcRole } from '../DrpcRole'
import { DrpcRequestMessage } from '../messages'
import { DrpcMessageRecord } from '../repository/DrpcMessageRecord'
import { DrpcMessageRepository } from '../repository/DrpcMessageRepository'
import { DrpcService } from '../services'

jest.mock('../repository/DrpcMessageRepository')
const DrpcMessageRepositoryMock = DrpcMessageRepository as jest.Mock<DrpcMessageRepository>
const drpcMessageRepository = new DrpcMessageRepositoryMock()

jest.mock('../../../core/src/agent/EventEmitter')
const EventEmitterMock = EventEmitter as jest.Mock<EventEmitter>
const eventEmitter = new EventEmitterMock()

const agentContext = getAgentContext()

describe('DrpcService', () => {
  let drpcMessageService: DrpcService
  const mockConnectionRecord = getMockConnection({
    id: 'd3849ac3-c981-455b-a1aa-a10bea6cead8',
    did: 'did:sov:C2SsBf5QUQpqSAQfhu3sd2',
  })

  beforeEach(() => {
    drpcMessageService = new DrpcService(drpcMessageRepository, eventEmitter)
  })

  describe('createMessage', () => {
    it(`creates message and record, and emits message and basic message record`, async () => {
      const messageRequest: DrpcRequestObject = {
        jsonrpc: '2.0',
        method: 'hello',
        id: 1,
      }
      const { message } = await drpcMessageService.createRequestMessage(
        agentContext,
        messageRequest,
        mockConnectionRecord
      )

      expect(message).toBeInstanceOf(DrpcRequestMessage)
      expect((message.request as DrpcRequestObject).method).toBe('hello')

      expect(drpcMessageRepository.save).toHaveBeenCalledWith(agentContext, expect.any(DrpcMessageRecord))
      expect(eventEmitter.emit).toHaveBeenCalledWith(agentContext, {
        type: 'DrpcRequestStateChanged',
        payload: {
          drpcMessageRecord: expect.objectContaining({
            connectionId: mockConnectionRecord.id,
            content: expect.any(DrpcRequestMessage),
            role: DrpcRole.Sender,
          }),
        },
      })
    })
  })

  describe('save', () => {
    it(`stores record and emits message and basic message record`, async () => {
      const drpcMessage = new DrpcRequestMessage({ request: { jsonrpc: '2.0', method: 'hello', id: 1 } })

      const messageContext = new InboundMessageContext(drpcMessage, { agentContext })

      await drpcMessageService.save(messageContext, mockConnectionRecord)

      expect(drpcMessageRepository.save).toHaveBeenCalledWith(agentContext, expect.any(DrpcMessageRecord))
      expect(eventEmitter.emit).toHaveBeenCalledWith(agentContext, {
        type: 'DrpcRequestStateChanged',
        payload: {
          drpcMessageRecord: expect.objectContaining({
            connectionId: mockConnectionRecord.id,
            content: expect.any(DrpcRequestMessage),
            role: DrpcRole.Receiver,
          }),
        },
      })
    })
  })
})
