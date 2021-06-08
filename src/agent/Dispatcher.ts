import { Lifecycle, scoped } from 'tsyringe'

import { ReturnRouteTypes } from '../decorators/transport/TransportDecorator'
import { AriesFrameworkError } from '../error/AriesFrameworkError'
import { OutboundMessage, OutboundPackage } from '../types'

import { AgentMessage } from './AgentMessage'
import { Handler } from './Handler'
import { MessageSender } from './MessageSender'
import { TransportService } from './TransportService'
import { InboundMessageContext } from './models/InboundMessageContext'

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

  public async dispatch(messageContext: InboundMessageContext): Promise<OutboundMessage | OutboundPackage | undefined> {
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

      // check for return routing, with thread id
      if (message.hasReturnRouting(threadId)) {
        return await this.messageSender.packMessage(outboundMessage)
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
