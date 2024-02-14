import type { DrpcRequest, DrpcResponse, DrpcRequestMessage, DrpcResponseMessage } from './messages'
import type { DrpcMessageRecord } from './repository/DrpcMessageRecord'
import type { ConnectionRecord } from '@credo-ts/core'

import {
  AgentContext,
  MessageHandlerRegistry,
  MessageSender,
  OutboundMessageContext,
  injectable,
  ConnectionService,
} from '@credo-ts/core'

import { DrpcRequestHandler, DrpcResponseHandler } from './handlers'
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
    const connection = await this.connectionService.getById(this.agentContext, connectionId)
    const { message: drpcMessage, record: drpcMessageRecord } = await this.drpcMessageService.createRequestMessage(
      this.agentContext,
      request,
      connection.id
    )
    const messageId = drpcMessage.id
    await this.sendMessage(connection, drpcMessage, drpcMessageRecord)
    return new Promise((resolve) => {
      const listener = ({
        drpcMessageRecord,
        removeListener,
      }: {
        drpcMessageRecord: DrpcMessageRecord
        removeListener: () => void
      }) => {
        const message = drpcMessageRecord.message
        if (drpcMessageRecord.threadId === messageId) {
          removeListener()

          resolve(message)
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
        const message = drpcMessageRecord.message
        removeListener()
        resolve({
          connectionId: drpcMessageRecord.connectionId,
          threadId: drpcMessageRecord.threadId,
          request: message as DrpcRequest,
        })
      }

      this.drpcMessageService.createRequestListener(listener)
    })
  }

  public async sendResponse(connectionId: string, threadId: string, response: DrpcResponse): Promise<void> {
    const connection = await this.connectionService.getById(this.agentContext, connectionId)
    const drpcMessageRecord = await this.drpcMessageService.findByThreadAndConnectionId(
      this.agentContext,
      connectionId,
      threadId
    )
    if (!drpcMessageRecord) {
      throw new Error(`No request found for threadId ${threadId}`)
    }
    const { message, record } = await this.drpcMessageService.createResponseMessage(
      this.agentContext,
      response,
      drpcMessageRecord
    )
    await this.sendMessage(connection, message, record)
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
    messageHandlerRegistry.registerMessageHandler(new DrpcRequestHandler(this.drpcMessageService))
    messageHandlerRegistry.registerMessageHandler(new DrpcResponseHandler(this.drpcMessageService))
  }
}
