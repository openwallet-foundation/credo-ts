import { getAgentContext, getMockConnection } from '../../../../../../tests/helpers'
import { EventEmitter } from '../../../../../agent/EventEmitter'
import { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import { BasicMessageRole } from '../../../BasicMessageRole'
import { BasicMessageRecord } from '../../../repository/BasicMessageRecord'
import { BasicMessageRepository } from '../../../repository/BasicMessageRepository'
import { V2BasicMessageProtocol } from '../V2BasicMessageProtocol'
import { V2BasicMessage } from '../messages'

jest.mock('../../../repository/BasicMessageRepository')
const BasicMessageRepositoryMock = BasicMessageRepository as jest.Mock<BasicMessageRepository>
const basicMessageRepository = new BasicMessageRepositoryMock()

jest.mock('../../../../../agent/EventEmitter')
const EventEmitterMock = EventEmitter as jest.Mock<EventEmitter>
const eventEmitter = new EventEmitterMock()

const agentContext = getAgentContext({
  registerInstances: [
    [BasicMessageRepository, basicMessageRepository],
    [EventEmitter, eventEmitter],
  ],
})

describe('V2BasicMessageProtocol', () => {
  let basicMessageProtocol: V2BasicMessageProtocol
  const mockConnectionRecord = getMockConnection({
    id: 'd3849ac3-c981-455b-a1aa-a10bea6cead8',
    did: 'did:sov:C2SsBf5QUQpqSAQfhu3sd2',
  })

  beforeEach(() => {
    basicMessageProtocol = new V2BasicMessageProtocol()
  })

  describe('createMessage', () => {
    it(`creates message and record, and emits message and basic message record`, async () => {
      const { message } = await basicMessageProtocol.createMessage(agentContext, {
        content: 'hello',
        connectionRecord: mockConnectionRecord,
      })

      expect(message.body.content).toBe('hello')

      expect(basicMessageRepository.save).toHaveBeenCalledWith(agentContext, expect.any(BasicMessageRecord))
      expect(eventEmitter.emit).not.toHaveBeenCalledWith(agentContext, {
        type: 'BasicMessageStateChanged',
        payload: {
          basicMessageRecord: expect.objectContaining({
            connectionId: mockConnectionRecord.id,
            id: expect.any(String),
            sentTime: expect.any(String),
            content: 'hello',
            role: BasicMessageRole.Sender,
          }),
          message,
        },
      })
    })
  })

  describe('save', () => {
    it(`stores record and emits message and basic message record`, async () => {
      const basicMessage = new V2BasicMessage({
        id: '123',
        content: 'message',
      })

      const messageContext = new InboundMessageContext(basicMessage, { agentContext })

      await basicMessageProtocol.save(messageContext, mockConnectionRecord)

      expect(basicMessageRepository.save).toHaveBeenCalledWith(agentContext, expect.any(BasicMessageRecord))
      expect(eventEmitter.emit).not.toHaveBeenCalledWith(agentContext, {
        type: 'BasicMessageStateChanged',
        payload: {
          basicMessageRecord: expect.objectContaining({
            connectionId: mockConnectionRecord.id,
            id: expect.any(String),
            sentTime: new Date(basicMessage.createdTime).toISOString(),
            content: basicMessage.body.content,
            role: BasicMessageRole.Receiver,
          }),
          message: messageContext.message,
        },
      })
    })
  })
})
