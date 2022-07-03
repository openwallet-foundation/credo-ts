import type { Logger } from '../logger'
import type { OutboundMessage, OutboundServiceMessage } from '../types'
import type { AgentMessage } from './AgentMessage'
import type { AgentMessageProcessedEvent } from './Events'
import type { Handler } from './Handler'
import type { InboundMessageContext } from './models/InboundMessageContext'

import { AgentConfig } from '../agent/AgentConfig'
import { AriesFrameworkError } from '../error/AriesFrameworkError'
import { injectable } from '../plugins'
import { canHandleMessageType, parseMessageType } from '../utils/messageType'

import { ProblemReportMessage } from './../modules/problem-reports/messages/ProblemReportMessage'
import { EventEmitter } from './EventEmitter'
import { AgentEventTypes } from './Events'
import { MessageSender } from './MessageSender'
import { isOutboundServiceMessage } from './helpers'

@injectable()
class Dispatcher {
  private handlers: Handler[] = []
  private messageSender: MessageSender
  private eventEmitter: EventEmitter
  private logger: Logger

  public constructor(messageSender: MessageSender, eventEmitter: EventEmitter, agentConfig: AgentConfig) {
    this.messageSender = messageSender
    this.eventEmitter = eventEmitter
    this.logger = agentConfig.logger
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

    let outboundMessage: OutboundMessage<AgentMessage> | OutboundServiceMessage<AgentMessage> | void

    try {
      outboundMessage = await handler.handle(messageContext)
    } catch (error) {
      const problemReportMessage = error.problemReport

      if (problemReportMessage instanceof ProblemReportMessage && messageContext.connection) {
        problemReportMessage.setThread({
          threadId: messageContext.message.threadId,
        })
        outboundMessage = {
          payload: problemReportMessage,
          connection: messageContext.connection,
        }
      } else {
        this.logger.error(`Error handling message with type ${message.type}`, {
          message: message.toJSON(),
          error,
          senderKey: messageContext.senderKey?.fingerprint,
          recipientKey: messageContext.recipientKey?.fingerprint,
          connectionId: messageContext.connection?.id,
        })

        throw error
      }
    }

    if (outboundMessage && isOutboundServiceMessage(outboundMessage)) {
      await this.messageSender.sendMessageToService({
        message: outboundMessage.payload,
        service: outboundMessage.service,
        senderKey: outboundMessage.senderKey,
        returnRoute: true,
      })
    } else if (outboundMessage) {
      outboundMessage.sessionId = messageContext.sessionId
      await this.messageSender.sendMessage(outboundMessage)
    }

    // Emit event that allows to hook into received messages
    this.eventEmitter.emit<AgentMessageProcessedEvent>({
      type: AgentEventTypes.AgentMessageProcessed,
      payload: {
        message: messageContext.message,
        connection: messageContext.connection,
      },
    })
  }

  private getHandlerForType(messageType: string): Handler | undefined {
    const incomingMessageType = parseMessageType(messageType)

    for (const handler of this.handlers) {
      for (const MessageClass of handler.supportedMessages) {
        if (canHandleMessageType(MessageClass, incomingMessageType)) return handler
      }
    }
  }

  public getMessageClassForType(messageType: string): typeof AgentMessage | undefined {
    const incomingMessageType = parseMessageType(messageType)

    for (const handler of this.handlers) {
      for (const MessageClass of handler.supportedMessages) {
        if (canHandleMessageType(MessageClass, incomingMessageType)) return MessageClass
      }
    }
  }

  /**
   * Returns array of message types that dispatcher is able to handle.
   * Message type format is MTURI specified at https://github.com/hyperledger/aries-rfcs/blob/main/concepts/0003-protocols/README.md#mturi.
   */
  public get supportedMessageTypes() {
    return this.handlers
      .reduce<typeof AgentMessage[]>((all, cur) => [...all, ...cur.supportedMessages], [])
      .map((m) => m.type)
  }

  /**
   * Returns array of protocol IDs that dispatcher is able to handle.
   * Protocol ID format is PIURI specified at https://github.com/hyperledger/aries-rfcs/blob/main/concepts/0003-protocols/README.md#piuri.
   */
  public get supportedProtocols() {
    return Array.from(new Set(this.supportedMessageTypes.map((m) => m.protocolUri)))
  }

  public filterSupportedProtocolsByMessageFamilies(messageFamilies: string[]) {
    return this.supportedProtocols.filter((protocolId) =>
      messageFamilies.find((messageFamily) => protocolId.startsWith(messageFamily))
    )
  }
}

export { Dispatcher }
