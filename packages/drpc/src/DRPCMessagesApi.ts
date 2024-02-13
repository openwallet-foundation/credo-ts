import type { DRPCRequest, DRPCResponse } from './messages'
import type { DRPCMessageRecord } from './repository/DRPCMessageRecord'
import type { ConnectionRecord } from '@credo-ts/core'

import {
  AgentContext,
  MessageHandlerRegistry,
  MessageSender,
  OutboundMessageContext,
  injectable,
  utils,
  ConnectionService,
} from '@credo-ts/core'

import { DRPCMessageHandler } from './handlers'
import { DRPCRequestMessage, DRPCResponseMessage } from './messages'
import { DRPCMessageService } from './services'

@injectable()
export class DRPCMessagesApi {
  private drpcMessageService: DRPCMessageService
  private messageSender: MessageSender
  private connectionService: ConnectionService
  private agentContext: AgentContext

  public constructor(
    messageHandlerRegistry: MessageHandlerRegistry,
    drpcMessageService: DRPCMessageService,
    messageSender: MessageSender,
    connectionService: ConnectionService,
    agentContext: AgentContext
  ) {
    this.drpcMessageService = drpcMessageService
    this.messageSender = messageSender
    this.connectionService = connectionService
    this.agentContext = agentContext
    this.registerMessageHandlers(messageHandlerRegistry)
  }

  public async sendDRPCRequest(connectionId: string, request: DRPCRequest): Promise<DRPCResponse> {
    const messageId = utils.uuid()
    const connection = await this.connectionService.getById(this.agentContext, connectionId)
    try {
      const { message: drpcMessage, record: drpcMessageRecord } = await this.drpcMessageService.createRequestMessage(
        this.agentContext,
        request,
        connection,
        messageId
      )
      await this.sendDRPCMessage(connection, drpcMessage, drpcMessageRecord)
    } catch {
      throw new Error('Invalid DRPC Request')
    }
    return new Promise((resolve) => {
      const listener = ({
        drpcMessageRecord,
        removeListener,
      }: {
        drpcMessageRecord: DRPCMessageRecord
        removeListener: () => void
      }) => {
        const message = drpcMessageRecord.content
        if (message instanceof DRPCResponseMessage && message.threadId === messageId) {
          removeListener()

          resolve(message.response)
        }
      }

      this.drpcMessageService.createResponseListener(listener)
    })
  }

  public async nextDRPCRequest(): Promise<{ connectionId: string; threadId: string; request: DRPCRequest }> {
    return new Promise((resolve) => {
      const listener = ({
        drpcMessageRecord,
        removeListener,
      }: {
        drpcMessageRecord: DRPCMessageRecord
        removeListener: () => void
      }) => {
        const message = drpcMessageRecord.content
        if (message instanceof DRPCRequestMessage) {
          removeListener()
          resolve({
            connectionId: drpcMessageRecord.connectionId,
            threadId: message.threadId,
            request: message.request,
          })
        }
      }

      this.drpcMessageService.createRequestListener(listener)
    })
  }

  public async sendDRPCResponse(connectionId: string, threadId: string, response: DRPCResponse): Promise<void> {
    const connection = await this.connectionService.getById(this.agentContext, connectionId)
    const { message: drpcMessage, record: drpcMessageRecord } = await this.drpcMessageService.createResponseMessage(
      this.agentContext,
      response,
      connection
    )
    drpcMessage.setThread({ threadId })
    await this.sendDRPCMessage(connection, drpcMessage, drpcMessageRecord)
  }

  private async sendDRPCMessage(
    connection: ConnectionRecord,
    message: DRPCRequestMessage | DRPCResponseMessage,
    messageRecord: DRPCMessageRecord
  ): Promise<void> {
    const outboundMessageContext = new OutboundMessageContext(message, {
      agentContext: this.agentContext,
      connection,
      associatedRecord: messageRecord,
    })
    await this.messageSender.sendMessage(outboundMessageContext)
  }

  private registerMessageHandlers(messageHandlerRegistry: MessageHandlerRegistry) {
    messageHandlerRegistry.registerMessageHandler(new DRPCMessageHandler(this.drpcMessageService))
  }
}
