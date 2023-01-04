import { Subject } from 'rxjs'

import { getAgentConfig, getAgentContext } from '../../../tests/helpers'
import { DidCommV1Message, DidCommV2Message } from '../../didcomm'
import { parseMessageType } from '../../utils/messageType'
import { Dispatcher } from '../Dispatcher'
import { EventEmitter } from '../EventEmitter'
import { MessageHandlerRegistry } from '../MessageHandlerRegistry'
import { MessageSender } from '../MessageSender'
import { InboundMessageContext } from '../models/InboundMessageContext'

const testMessageType = `https://didcomm.org/fake-protocol/1.5/message`

class V1CustomProtocolMessage extends DidCommV1Message {
  public readonly type = V1CustomProtocolMessage.type.messageTypeUri
  public static readonly type = parseMessageType(testMessageType)
}

class V2CustomProtocolMessage extends DidCommV2Message {
  public readonly type = V2CustomProtocolMessage.type.messageTypeUri
  public static readonly type = parseMessageType(testMessageType)
}

describe('Dispatcher', () => {
  const agentConfig = getAgentConfig('DispatcherTest')
  const agentContext = getAgentContext()
  const MessageSenderMock = MessageSender as jest.Mock<MessageSender>
  const eventEmitter = new EventEmitter(agentConfig.agentDependencies, new Subject())

  describe('dispatch() for DidCommV1Message', () => {
    it('calls the handle method of the handler', async () => {
      const dispatcher = new Dispatcher(
        new MessageSenderMock(),
        eventEmitter,
        new MessageHandlerRegistry(),
        agentConfig.logger
      )
      const customProtocolMessage = new V1CustomProtocolMessage()
      const inboundMessageContext = new InboundMessageContext(customProtocolMessage, { agentContext })

      const mockHandle = jest.fn()
      dispatcher.registerMessageHandler({ supportedMessages: [V1CustomProtocolMessage], handle: mockHandle })

      await dispatcher.dispatch(inboundMessageContext)

      expect(mockHandle).toHaveBeenNthCalledWith(1, inboundMessageContext)
    })

    it('throws an error if no handler for the message could be found', async () => {
      const dispatcher = new Dispatcher(
        new MessageSenderMock(),
        eventEmitter,
        new MessageHandlerRegistry(),
        agentConfig.logger
      )
      const customProtocolMessage = new V1CustomProtocolMessage()
      const inboundMessageContext = new InboundMessageContext(customProtocolMessage, { agentContext })

      const mockHandle = jest.fn()
      dispatcher.registerMessageHandler({ supportedMessages: [], handle: mockHandle })

      await expect(dispatcher.dispatch(inboundMessageContext)).rejects.toThrow(
        `No handler for message type "${testMessageType}" found`
      )
    })
  })

  describe('dispatch() for DidCommV2Message', () => {
    it('calls the handle method of the handler', async () => {
      const dispatcher = new Dispatcher(
        new MessageSenderMock(),
        eventEmitter,
        new MessageHandlerRegistry(),
        agentConfig.logger
      )
      const customProtocolMessage = new V2CustomProtocolMessage()
      const inboundMessageContext = new InboundMessageContext(customProtocolMessage, { agentContext })

      const mockHandle = jest.fn()
      dispatcher.registerMessageHandler({ supportedMessages: [V2CustomProtocolMessage], handle: mockHandle })

      await dispatcher.dispatch(inboundMessageContext)

      expect(mockHandle).toHaveBeenNthCalledWith(1, inboundMessageContext)
    })

    it('throws an error if no handler for the message could be found', async () => {
      const dispatcher = new Dispatcher(
        new MessageSenderMock(),
        eventEmitter,
        new MessageHandlerRegistry(),
        agentConfig.logger
      )
      const customProtocolMessage = new V2CustomProtocolMessage()
      const inboundMessageContext = new InboundMessageContext(customProtocolMessage, { agentContext })

      const mockHandle = jest.fn()
      dispatcher.registerMessageHandler({ supportedMessages: [], handle: mockHandle })

      await expect(dispatcher.dispatch(inboundMessageContext)).rejects.toThrow(
        `No handler for message type "${testMessageType}" found`
      )
    })
  })
})
