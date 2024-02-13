import type { DrpcRequest, DrpcResponse } from './messages'
import type { DrpcMessageRecord } from './repository/DrpcMessageRecord'
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

import { DrpcHandler } from './handlers'
import { DrpcRequestMessage, DrpcResponseMessage } from './messages'
import { DrpcService } from './services'

@injectable()
export class DrpcApi {
  private drpcMessageService: DrpcService
  private messageSender: MessageSender
  private connectionService: ConnectionService
  private agentContext: AgentContext

  public constructor(
    messageHandlerRegistry: MessageHandlerRegistry,
    drpcMessageService: DrpcService,
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

  public async sendRequest(connectionId: string, request: DrpcRequest): Promise<DrpcResponse> {
    const messageId = utils.uuid()
    const connection = await this.connectionService.getById(this.agentContext, connectionId)
    const { message: drpcMessage, record: drpcMessageRecord } = await this.drpcMessageService.createRequestMessage(
      this.agentContext,
      request,
      connection,
      messageId
    )
    await this.sendMessage(connection, drpcMessage, drpcMessageRecord)

    return new Promise((resolve) => {
      const listener = ({
        drpcMessageRecord,
        removeListener,
      }: {
        drpcMessageRecord: DrpcMessageRecord
        removeListener: () => void
      }) => {
        const message = drpcMessageRecord.content
        if (message instanceof DrpcResponseMessage && message.threadId === messageId) {
          removeListener()

          resolve(message.response)
        }
      }

      this.drpcMessageService.createResponseListener(listener)
    })
  }

  public async nextRequest(): Promise<{ connectionId: string; threadId: string; request: DrpcRequest }> {
    return new Promise((resolve) => {
      const listener = ({
        drpcMessageRecord,
        removeListener,
      }: {
        drpcMessageRecord: DrpcMessageRecord
        removeListener: () => void
      }) => {
        const message = drpcMessageRecord.content
        if (message instanceof DrpcRequestMessage) {
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

  public async sendResponse(connectionId: string, threadId: string, response: DrpcResponse): Promise<void> {
    const connection = await this.connectionService.getById(this.agentContext, connectionId)
    const { message: drpcMessage, record: drpcMessageRecord } = await this.drpcMessageService.createResponseMessage(
      this.agentContext,
      response,
      connection
    )
    drpcMessage.setThread({ threadId })
    await this.sendMessage(connection, drpcMessage, drpcMessageRecord)
  }

  private async sendMessage(
    connection: ConnectionRecord,
    message: DrpcRequestMessage | DrpcResponseMessage,
    messageRecord: DrpcMessageRecord
  ): Promise<void> {
    const outboundMessageContext = new OutboundMessageContext(message, {
      agentContext: this.agentContext,
      connection,
      associatedRecord: messageRecord,
    })
    await this.messageSender.sendMessage(outboundMessageContext)
  }

  private registerMessageHandlers(messageHandlerRegistry: MessageHandlerRegistry) {
    messageHandlerRegistry.registerMessageHandler(new DrpcHandler(this.drpcMessageService))
  }
}
