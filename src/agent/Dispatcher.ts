import type { OutboundMessage, OutboundPackage } from '../types'
import type { AgentMessage } from './AgentMessage'
import type { Handler } from './Handler'
import type { InboundMessageContext } from './models/InboundMessageContext'

import { Lifecycle, scoped } from 'tsyringe'

import { ReturnRouteTypes } from '../decorators/transport/TransportDecorator'
import { AriesFrameworkError } from '../error/AriesFrameworkError'

import { MessageSender } from './MessageSender'
import { TransportService } from './TransportService'
import { ConsoleLogger, LogLevel } from '../logger'

const logger = new ConsoleLogger(LogLevel.debug)

@scoped(Lifecycle.ContainerScoped)
class Dispatcher {
  private handlers: Handler[] = []
  private messageSender: MessageSender
  private transportService: TransportService

  public constructor(messageSender: MessageSender, transportService: TransportService) {
    this.messageSender = messageSender
    this.transportService = transportService
  }

  public registerHandler(handler: Handler) {
    this.handlers.push(handler)
  }

  public async dispatch(messageContext: InboundMessageContext): Promise<void> {
    const message = messageContext.message
    const handler = this.getHandlerForType(message.type)

    if (!handler) {
      throw new AriesFrameworkError(`No handler for message type "${message.type}" found`)
    }

    const outboundMessage = await handler.handle(messageContext)

    if (outboundMessage) {
      const threadId = outboundMessage.payload.threadId

      if (!this.transportService.hasInboundEndpoint(outboundMessage.connection)) {
        outboundMessage.payload.setReturnRouting(ReturnRouteTypes.all)
      }

      // Check for return routing, with thread id
      if (message.hasReturnRouting(threadId)) {
        const keys = {
          recipientKeys: messageContext.senderVerkey ? [messageContext.senderVerkey] : [],
          routingKeys: [],
          senderKey: messageContext.connection?.verkey || null,
        }
        const session = this.transportService.findSession(messageContext.connection?.id || '')
        const outboundPackage = await this.messageSender.packMessage(outboundMessage, keys)
        try {
          await session.send(outboundPackage)
          return
        } catch (error) {
          logger.info('The transport session has been closed or failed to send the outbound message.', error)
        }
      }

      await this.messageSender.sendMessage(outboundMessage)
    }
  }

  private getHandlerForType(messageType: string): Handler | undefined {
    for (const handler of this.handlers) {
      for (const MessageClass of handler.supportedMessages) {
        if (MessageClass.type === messageType) return handler
      }
    }
  }

  public getMessageClassForType(messageType: string): typeof AgentMessage | undefined {
    for (const handler of this.handlers) {
      for (const MessageClass of handler.supportedMessages) {
        if (MessageClass.type === messageType) return MessageClass
      }
    }
  }
}

export { Dispatcher }
