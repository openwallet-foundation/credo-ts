import { Subject } from 'rxjs'

import type { MockedClassConstructor } from '../../../../tests/types'
import { EventEmitter } from '../../../core/src/agent/EventEmitter'
import { getAgentConfig, getAgentContext } from '../../../core/tests/helpers'
import { DidCommDispatcher } from '../DidCommDispatcher'
import { DidCommEventTypes } from '../DidCommEvents'
import { DidCommMessage } from '../DidCommMessage'
import { DidCommMessageHandlerRegistry } from '../DidCommMessageHandlerRegistry'
import { DidCommMessageSender } from '../DidCommMessageSender'
import { getOutboundDidCommMessageContext } from '../getDidCommOutboundMessageContext'
import { DidCommInboundMessageContext } from '../models'
import type { DidCommConnectionRecord } from '../modules/connections'
import { parseMessageType } from '../util/messageType'

vi.mock('../DidCommMessageSender')

class CustomProtocolMessage extends DidCommMessage {
  public readonly type = CustomProtocolMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/fake-protocol/1.5/message')

  public constructor(options: { id?: string }) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
    }
  }
}

describe('DidCommDispatcher', () => {
  const agentConfig = getAgentConfig('DispatcherTest')
  const agentContext = getAgentContext()
  const MessageSenderMock = DidCommMessageSender as MockedClassConstructor<typeof DidCommMessageSender>
  const eventEmitter = new EventEmitter(agentConfig.agentDependencies, new Subject())

  describe('dispatch()', () => {
    it('calls the handle method of the handler', async () => {
      const messageHandlerRegistry = new DidCommMessageHandlerRegistry()
      const dispatcher = new DidCommDispatcher(
        new MessageSenderMock(),
        eventEmitter,
        messageHandlerRegistry,
        agentConfig.logger
      )
      const customProtocolMessage = new CustomProtocolMessage({})
      const inboundMessageContext = new DidCommInboundMessageContext(customProtocolMessage, { agentContext })

      const mockHandle = vi.fn()
      messageHandlerRegistry.registerMessageHandler({ supportedMessages: [CustomProtocolMessage], handle: mockHandle })

      await dispatcher.dispatch(inboundMessageContext)

      expect(mockHandle).toHaveBeenNthCalledWith(1, inboundMessageContext)
    })

    it('throws an error if no handler for the message could be found', async () => {
      const messageHandlerRegistry = new DidCommMessageHandlerRegistry()
      const dispatcher = new DidCommDispatcher(
        new MessageSenderMock(),
        eventEmitter,
        new DidCommMessageHandlerRegistry(),
        agentConfig.logger
      )
      const customProtocolMessage = new CustomProtocolMessage({
        id: '55170d10-b91f-4df2-9dcd-6deb4e806c1b',
      })
      const inboundMessageContext = new DidCommInboundMessageContext(customProtocolMessage, { agentContext })

      const mockHandle = vi.fn()
      messageHandlerRegistry.registerMessageHandler({ supportedMessages: [], handle: mockHandle })

      await expect(dispatcher.dispatch(inboundMessageContext)).rejects.toThrow(
        'Error handling message 55170d10-b91f-4df2-9dcd-6deb4e806c1b with type https://didcomm.org/fake-protocol/1.5/message. The message type is not supported'
      )
    })

    it('calls the middleware in the order they are registered', async () => {
      const agentContext = getAgentContext()

      // Replace the DidCommMessageHandlerRegistry instance with a empty one
      agentContext.dependencyManager.registerInstance(
        DidCommMessageHandlerRegistry,
        new DidCommMessageHandlerRegistry()
      )

      const dispatcher = new DidCommDispatcher(
        new MessageSenderMock(),
        eventEmitter,
        agentContext.dependencyManager.resolve(DidCommMessageHandlerRegistry),
        agentConfig.logger
      )

      const customProtocolMessage = new CustomProtocolMessage({
        id: '55170d10-b91f-4df2-9dcd-6deb4e806c1b',
      })
      const inboundMessageContext = new DidCommInboundMessageContext(customProtocolMessage, { agentContext })

      const firstMiddleware = vi.fn().mockImplementation(async (_, next) => next())
      const secondMiddleware = vi.fn()
      agentContext.dependencyManager
        .resolve(DidCommMessageHandlerRegistry)
        .registerMessageHandlerMiddleware(firstMiddleware)
      agentContext.dependencyManager
        .resolve(DidCommMessageHandlerRegistry)
        .registerMessageHandlerMiddleware(secondMiddleware)

      await dispatcher.dispatch(inboundMessageContext)

      expect(firstMiddleware).toHaveBeenCalled()
      expect(secondMiddleware).toHaveBeenCalled()

      // Verify the order of calls
      const firstMiddlewareCallOrder = firstMiddleware.mock.invocationCallOrder[0]
      const secondMiddlewareCallOrder = secondMiddleware.mock.invocationCallOrder[0]
      expect(firstMiddlewareCallOrder).toBeLessThan(secondMiddlewareCallOrder)
    })

    it('calls the middleware in the order they are registered', async () => {
      const agentContext = getAgentContext()

      // Replace the DidCommMessageHandlerRegistry instance with a empty one
      agentContext.dependencyManager.registerInstance(
        DidCommMessageHandlerRegistry,
        new DidCommMessageHandlerRegistry()
      )

      const dispatcher = new DidCommDispatcher(
        new MessageSenderMock(),
        eventEmitter,
        agentContext.dependencyManager.resolve(DidCommMessageHandlerRegistry),
        agentConfig.logger
      )

      const customProtocolMessage = new CustomProtocolMessage({
        id: '55170d10-b91f-4df2-9dcd-6deb4e806c1b',
      })
      const inboundMessageContext = new DidCommInboundMessageContext(customProtocolMessage, { agentContext })

      const firstMiddleware = vi.fn().mockImplementation(async (_, next) => next())
      const secondMiddleware = vi.fn()
      agentContext.dependencyManager
        .resolve(DidCommMessageHandlerRegistry)
        .registerMessageHandlerMiddleware(firstMiddleware)
      agentContext.dependencyManager
        .resolve(DidCommMessageHandlerRegistry)
        .registerMessageHandlerMiddleware(secondMiddleware)

      await dispatcher.dispatch(inboundMessageContext)

      expect(firstMiddleware).toHaveBeenCalled()
      expect(secondMiddleware).toHaveBeenCalled()

      // Verify the order of calls
      const firstMiddlewareCallOrder = firstMiddleware.mock.invocationCallOrder[0]
      const secondMiddlewareCallOrder = secondMiddleware.mock.invocationCallOrder[0]
      expect(firstMiddlewareCallOrder).toBeLessThan(secondMiddlewareCallOrder)
    })

    it('correctly calls the fallback message handler if no message handler is registered for the message type', async () => {
      const agentContext = getAgentContext()

      // Replace the DidCommMessageHandlerRegistry instance with a empty one
      agentContext.dependencyManager.registerInstance(
        DidCommMessageHandlerRegistry,
        new DidCommMessageHandlerRegistry()
      )

      const dispatcher = new DidCommDispatcher(
        new MessageSenderMock(),
        eventEmitter,
        agentContext.dependencyManager.resolve(DidCommMessageHandlerRegistry),
        agentConfig.logger
      )

      const customProtocolMessage = new CustomProtocolMessage({
        id: '55170d10-b91f-4df2-9dcd-6deb4e806c1b',
      })
      const inboundMessageContext = new DidCommInboundMessageContext(customProtocolMessage, { agentContext })

      const fallbackMessageHandler = vi.fn()
      agentContext.dependencyManager
        .resolve(DidCommMessageHandlerRegistry)
        .setFallbackMessageHandler(fallbackMessageHandler)

      await dispatcher.dispatch(inboundMessageContext)

      expect(fallbackMessageHandler).toHaveBeenCalled()
    })

    it('will not call the message handler if the middleware does not call next (intercept incoming message handling)', async () => {
      const agentContext = getAgentContext()

      // Replace the DidCommMessageHandlerRegistry instance with a empty one
      agentContext.dependencyManager.registerInstance(
        DidCommMessageHandlerRegistry,
        new DidCommMessageHandlerRegistry()
      )

      const dispatcher = new DidCommDispatcher(
        new MessageSenderMock(),
        eventEmitter,
        agentContext.dependencyManager.resolve(DidCommMessageHandlerRegistry),
        agentConfig.logger
      )

      const customProtocolMessage = new CustomProtocolMessage({
        id: '55170d10-b91f-4df2-9dcd-6deb4e806c1b',
      })
      const inboundMessageContext = new DidCommInboundMessageContext(customProtocolMessage, { agentContext })

      const mockHandle = vi.fn()
      agentContext.dependencyManager.resolve(DidCommMessageHandlerRegistry).registerMessageHandlers([
        {
          supportedMessages: [CustomProtocolMessage],
          handle: mockHandle,
        },
      ])

      const middleware = vi.fn()
      agentContext.dependencyManager.resolve(DidCommMessageHandlerRegistry).registerMessageHandlerMiddleware(middleware)
      await dispatcher.dispatch(inboundMessageContext)
      expect(mockHandle).not.toHaveBeenCalled()

      // Not it should call it, as the middleware calls next
      middleware.mockImplementationOnce((_, next) => next())
      await dispatcher.dispatch(inboundMessageContext)
      expect(mockHandle).toHaveBeenCalled()
    })

    it('calls the message handler set by the middleware', async () => {
      const agentContext = getAgentContext()

      // Replace the DidCommMessageHandlerRegistry instance with a empty one
      agentContext.dependencyManager.registerInstance(
        DidCommMessageHandlerRegistry,
        new DidCommMessageHandlerRegistry()
      )

      const dispatcher = new DidCommDispatcher(
        new MessageSenderMock(),
        eventEmitter,
        agentContext.dependencyManager.resolve(DidCommMessageHandlerRegistry),
        agentConfig.logger
      )

      const customProtocolMessage = new CustomProtocolMessage({
        id: '55170d10-b91f-4df2-9dcd-6deb4e806c1b',
      })
      const inboundMessageContext = new DidCommInboundMessageContext(customProtocolMessage, { agentContext })

      const handle = vi.fn()
      const middleware = vi
        .fn()
        .mockImplementationOnce(async (inboundMessageContext: DidCommInboundMessageContext, next) => {
          inboundMessageContext.messageHandler = {
            supportedMessages: [],
            handle: handle,
          }

          await next()
        })

      agentContext.dependencyManager.resolve(DidCommMessageHandlerRegistry).registerMessageHandlerMiddleware(middleware)
      await dispatcher.dispatch(inboundMessageContext)
      expect(middleware).toHaveBeenCalled()
      expect(handle).toHaveBeenCalled()
    })

    it('sends the response message set by the middleware', async () => {
      const agentContext = getAgentContext({
        agentConfig,
      })
      const messageSenderMock = new MessageSenderMock()

      // Replace the DidCommMessageHandlerRegistry instance with a empty one
      agentContext.dependencyManager.registerInstance(
        DidCommMessageHandlerRegistry,
        new DidCommMessageHandlerRegistry()
      )

      const dispatcher = new DidCommDispatcher(
        messageSenderMock,
        eventEmitter,
        agentContext.dependencyManager.resolve(DidCommMessageHandlerRegistry),
        agentConfig.logger
      )

      const connectionMock = vi.fn() as unknown as DidCommConnectionRecord

      const customProtocolMessage = new CustomProtocolMessage({
        id: '55170d10-b91f-4df2-9dcd-6deb4e806c1b',
      })
      const inboundMessageContext = new DidCommInboundMessageContext(customProtocolMessage, {
        agentContext,
        connection: connectionMock,
      })

      const middleware = vi.fn().mockImplementationOnce(async (inboundMessageContext: DidCommInboundMessageContext) => {
        // We do not call next
        inboundMessageContext.responseMessage = await getOutboundDidCommMessageContext(
          inboundMessageContext.agentContext,
          {
            message: new CustomProtocolMessage({
              id: 'static-id',
            }),
            connectionRecord: inboundMessageContext.connection,
          }
        )
      })

      agentContext.dependencyManager.resolve(DidCommMessageHandlerRegistry).registerMessageHandlerMiddleware(middleware)
      await dispatcher.dispatch(inboundMessageContext)
      expect(middleware).toHaveBeenCalled()
      expect(messageSenderMock.sendMessage).toHaveBeenCalledWith({
        inboundMessageContext,
        agentContext,
        associatedRecord: undefined,
        connection: connectionMock,
        message: new CustomProtocolMessage({
          id: 'static-id',
        }),
        outOfBand: undefined,
        serviceParams: undefined,
        sessionId: undefined,
      })
    })

    it('emits the processed event with handled false when a middleware does not call next', async () => {
      const agentContext = getAgentContext()
      const messageHandlerRegistry = new DidCommMessageHandlerRegistry()
      agentContext.dependencyManager.registerInstance(DidCommMessageHandlerRegistry, messageHandlerRegistry)
      const eventEmitter = new EventEmitter(agentConfig.agentDependencies, new Subject())
      const dispatcher = new DidCommDispatcher(
        new MessageSenderMock(),
        eventEmitter,
        messageHandlerRegistry,
        agentConfig.logger
      )

      const handle = vi.fn()
      messageHandlerRegistry.registerMessageHandler({ supportedMessages: [CustomProtocolMessage], handle })
      messageHandlerRegistry.registerMessageHandlerMiddleware(vi.fn())

      const listener = vi.fn()
      eventEmitter.on(DidCommEventTypes.DidCommMessageProcessed, listener)

      await dispatcher.dispatch(new DidCommInboundMessageContext(new CustomProtocolMessage({}), { agentContext }))

      expect(handle).not.toHaveBeenCalled()
      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ payload: expect.objectContaining({ handled: false }) })
      )
    })

    it('emits the processed event with handled true after the response is sent', async () => {
      const agentContext = getAgentContext({ agentConfig })
      const messageHandlerRegistry = new DidCommMessageHandlerRegistry()
      agentContext.dependencyManager.registerInstance(DidCommMessageHandlerRegistry, messageHandlerRegistry)
      const eventEmitter = new EventEmitter(agentConfig.agentDependencies, new Subject())
      const messageSenderMock = new MessageSenderMock()
      const dispatcher = new DidCommDispatcher(
        messageSenderMock,
        eventEmitter,
        messageHandlerRegistry,
        agentConfig.logger
      )

      messageHandlerRegistry.registerMessageHandler({
        supportedMessages: [CustomProtocolMessage],
        handle: async (inboundMessageContext) =>
          getOutboundDidCommMessageContext(inboundMessageContext.agentContext, {
            message: new CustomProtocolMessage({ id: 'static-id' }),
            connectionRecord: inboundMessageContext.connection,
          }),
      })

      const listener = vi.fn()
      eventEmitter.on(DidCommEventTypes.DidCommMessageProcessed, listener)

      await dispatcher.dispatch(
        new DidCommInboundMessageContext(new CustomProtocolMessage({}), {
          agentContext,
          connection: vi.fn() as unknown as DidCommConnectionRecord,
        })
      )

      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ payload: expect.objectContaining({ handled: true }) })
      )
      expect(vi.mocked(messageSenderMock.sendMessage).mock.invocationCallOrder[0]).toBeLessThan(
        listener.mock.invocationCallOrder[0]
      )
    })
  })
})
