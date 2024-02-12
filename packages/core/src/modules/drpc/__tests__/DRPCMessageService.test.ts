import type { DRPCRequestObject } from '../messages'

import { getAgentContext, getMockConnection } from '../../../../tests/helpers'
import { EventEmitter } from '../../../agent/EventEmitter'
import { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import { DRPCMessageRole } from '../DRPCMessageRole'
import { DRPCRequestMessage } from '../messages'
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
      const { message } = await drpcMessageService.createRequestMessage(
        agentContext,
        messageRequest,
        mockConnectionRecord
      )

      expect(message).toBeInstanceOf(DRPCRequestMessage)
      expect((message.request as DRPCRequestObject).method).toBe('hello')

      expect(drpcMessageRepository.save).toHaveBeenCalledWith(agentContext, expect.any(DRPCMessageRecord))
      expect(eventEmitter.emit).toHaveBeenCalledWith(agentContext, {
        type: 'DRPCRequestStateChanged',
        payload: {
          drpcMessageRecord: expect.objectContaining({
            connectionId: mockConnectionRecord.id,
            content: expect.any(DRPCRequestMessage),
            role: DRPCMessageRole.Sender,
          })
        },
      })
    })
  })

  describe('save', () => {
    it(`stores record and emits message and basic message record`, async () => {
      const drpcMessage = new DRPCRequestMessage({ request: { jsonrpc: '2.0', method: 'hello', id: 1 } })

      const messageContext = new InboundMessageContext(drpcMessage, { agentContext })

      await drpcMessageService.save(messageContext, mockConnectionRecord)

      expect(drpcMessageRepository.save).toHaveBeenCalledWith(agentContext, expect.any(DRPCMessageRecord))
      expect(eventEmitter.emit).toHaveBeenCalledWith(agentContext, {
        type: 'DRPCRequestStateChanged',
        payload: {
          drpcMessageRecord: expect.objectContaining({
            connectionId: mockConnectionRecord.id,
            content: expect.any(DRPCRequestMessage),
            role: DRPCMessageRole.Receiver,
          }),
        },
      })
    })
  })
})
