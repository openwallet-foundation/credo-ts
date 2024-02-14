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

  /**
   * sends the request object to the connection and returns a function that will resolve to the response
   * @param connectionId the connection to send the request to
   * @param request the request object
   * @returns curried function that waits for the response
   */
  public async sendRequest(connectionId: string, request: DrpcRequest): Promise<() => Promise<DrpcResponse>> {
    const connection = await this.connectionService.getById(this.agentContext, connectionId)
    const { message: drpcMessage, record: drpcMessageRecord } = await this.drpcMessageService.createRequestMessage(
      this.agentContext,
      request,
      connection.id
    )
    const messageId = drpcMessage.id
    await this.sendMessage(connection, drpcMessage, drpcMessageRecord)
    return this.recvResponse.bind(this, messageId)
  }

  /**
   * Listen for a response that has a thread id matching the provided messageId
   * @param messageId the id to match the response to
   * @returns the response object
   */
  private async recvResponse(messageId: string): Promise<DrpcResponse> {
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
          resolve(message as DrpcResponse)
        }
      }

      this.drpcMessageService.createResponseListener(listener)
    })
  }

  /**
   * Listen for a request and returns the request object and a function to send the response
   * @returns the request object and a function to send the response
   */
  public async recvRequest(): Promise<{
    request: DrpcRequest
    sendResponse: (response: DrpcResponse) => Promise<void>
  }> {
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
          sendResponse: async (response: DrpcResponse) => {
            await this.sendResponse(drpcMessageRecord.connectionId, drpcMessageRecord.threadId, response)
          },
          request: message as DrpcRequest,
        })
      }

      this.drpcMessageService.createRequestListener(listener)
    })
  }

  /**
   * Sends a drpc response to a connection
   * @param connectionId the connection id to use
   * @param threadId the thread id to respond to
   * @param response the drpc response object to send
   */
  private async sendResponse(connectionId: string, threadId: string, response: DrpcResponse): Promise<void> {
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
