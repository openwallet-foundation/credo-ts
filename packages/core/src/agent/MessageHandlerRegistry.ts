import type { AgentMessage } from './AgentMessage'
import type { MessageHandler } from './MessageHandler'

import { injectable } from 'tsyringe'

import { canHandleMessageType, parseMessageType } from '../utils/messageType'

@injectable()
export class MessageHandlerRegistry {
  private messageHandlers: MessageHandler[] = []

  public registerMessageHandler(messageHandler: MessageHandler) {
    this.messageHandlers.push(messageHandler)
  }

  public getHandlerForMessageType(messageType: string): MessageHandler | undefined {
    const incomingMessageType = parseMessageType(messageType)

    for (const handler of this.messageHandlers) {
      for (const MessageClass of handler.supportedMessages) {
        if (canHandleMessageType(MessageClass, incomingMessageType)) return handler
      }
    }
  }

  public getMessageClassForMessageType(messageType: string): typeof AgentMessage | undefined {
    const incomingMessageType = parseMessageType(messageType)

    for (const handler of this.messageHandlers) {
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
    return this.messageHandlers
      .reduce<(typeof AgentMessage)[]>((all, cur) => [...all, ...cur.supportedMessages], [])
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
