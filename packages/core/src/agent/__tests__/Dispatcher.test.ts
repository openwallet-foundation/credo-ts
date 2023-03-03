import { Subject } from 'rxjs'

import { getAgentConfig, getAgentContext } from '../../../tests/helpers'
import { parseMessageType } from '../../utils/messageType'
import { AgentMessage } from '../AgentMessage'
import { Dispatcher } from '../Dispatcher'
import { EventEmitter } from '../EventEmitter'
import { MessageHandlerRegistry } from '../MessageHandlerRegistry'
import { MessageSender } from '../MessageSender'
import { InboundMessageContext } from '../models/InboundMessageContext'

class CustomProtocolMessage extends AgentMessage {
  public readonly type = CustomProtocolMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/fake-protocol/1.5/message')
}

describe('Dispatcher', () => {
  const agentConfig = getAgentConfig('DispatcherTest')
  const agentContext = getAgentContext()
  const MessageSenderMock = MessageSender as jest.Mock<MessageSender>
  const eventEmitter = new EventEmitter(agentConfig.agentDependencies, new Subject())

  describe('dispatch()', () => {
    it('calls the handle method of the handler', async () => {
      const messageHandlerRegistry = new MessageHandlerRegistry()
      const dispatcher = new Dispatcher(
        new MessageSenderMock(),
        eventEmitter,
        messageHandlerRegistry,
        agentConfig.logger
      )
      const customProtocolMessage = new CustomProtocolMessage()
      const inboundMessageContext = new InboundMessageContext(customProtocolMessage, { agentContext })

      const mockHandle = jest.fn()
      messageHandlerRegistry.registerMessageHandler({ supportedMessages: [CustomProtocolMessage], handle: mockHandle })

      await dispatcher.dispatch(inboundMessageContext)

      expect(mockHandle).toHaveBeenNthCalledWith(1, inboundMessageContext)
    })

    it('throws an error if no handler for the message could be found', async () => {
      const messageHandlerRegistry = new MessageHandlerRegistry()
      const dispatcher = new Dispatcher(
        new MessageSenderMock(),
        eventEmitter,
        new MessageHandlerRegistry(),
        agentConfig.logger
      )
      const customProtocolMessage = new CustomProtocolMessage()
      const inboundMessageContext = new InboundMessageContext(customProtocolMessage, { agentContext })

      const mockHandle = jest.fn()
      messageHandlerRegistry.registerMessageHandler({ supportedMessages: [], handle: mockHandle })

      await expect(dispatcher.dispatch(inboundMessageContext)).rejects.toThrow(
        'No handler for message type "https://didcomm.org/fake-protocol/1.5/message" found'
      )
    })
  })
})
