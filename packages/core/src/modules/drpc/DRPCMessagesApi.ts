import type { DRPCMessageRecord } from './repository/DRPCMessageRecord'
import type { Query } from '../../storage/StorageService'

import { AgentContext } from '../../agent'
import { MessageHandlerRegistry } from '../../agent/MessageHandlerRegistry'
import { MessageSender } from '../../agent/MessageSender'
import { OutboundMessageContext } from '../../agent/models'
import { injectable } from '../../plugins'
import { ConnectionRecord, ConnectionService } from '../connections'

import { DRPCMessageHandler } from './handlers'
import { DRPCMessageService } from './services'
import { DRPCErrorCode, DRPCRequestMessage, DRPCRequestObject, DRPCResponseMessage, DRPCResponseObject } from './messages'
import { DRPCMessageRole } from './DRPCMessageRole'
import { DRPCMessageStateChangedEvent } from './DRPCMessageEvents'
import { uuid } from '../../utils/uuid'
import { isValidDRPCRequestObject } from '../../utils/messageType'

@injectable()
export class DRPCMessagesApi {
  private drpcMessageService: DRPCMessageService
  private drpcMethodHandlers: Map<string, (message: DRPCRequestObject) => Promise<DRPCResponseObject | {}>> = new Map()
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

    // listen for incoming drpc requests and forward them to appropriate handlers
    this.drpcMessageService.createMessageListener(async ({ message, drpcMessageRecord }) => {
      if (message instanceof DRPCRequestMessage && drpcMessageRecord.role === DRPCMessageRole.Receiver) {
        const requests = Array.isArray(message.request) ? message.request : [message.request]
        const futures = []
        for (const request of requests) {
          futures.push(this.handleRequest(request))
        }
        const responses = await Promise.all(futures)
        try {
          await this.sendDRPCResponse(drpcMessageRecord.connectionId, message.id, responses.length === 1 ? responses[0] : responses)
        } catch {
          await this.sendDRPCResponse(drpcMessageRecord.connectionId, message.id, { jsonrpc: '2.0', id: null, error: { code: DRPCErrorCode.INTERNAL_ERROR, message: 'Internal error', data: "Error sending response" } })
        }
      }
    })
  }

  private async handleRequest(message: DRPCRequestObject) {
    if (!isValidDRPCRequestObject(message)) {
      return {
        jsonrpc: '2.0',
        id: message.id,
        error: { code: DRPCErrorCode.INVALID_REQUEST, message: 'Invalid request' },
      }
    }
    const handler = this.drpcMethodHandlers.get(message.method)
    if (!handler) {
      return {
        jsonrpc: '2.0',
        id: message.id,
        error: { code: DRPCErrorCode.METHOD_NOT_FOUND, message: 'Method not found' },
      }
    }

    try {
      let response: DRPCResponseObject | {} = await handler(message)
      if (message.id === null) {
        response = {}
      }
      return response
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id: message.id,
        error: { code: DRPCErrorCode.INTERNAL_ERROR, message: 'Internal error', data: error.message },
      }
    }
  }

  public async sendDRPCRequest(connectionId: string, request: DRPCRequestObject | DRPCRequestObject[]): Promise<DRPCResponseObject | (DRPCRequestObject | {})[] | {}> {
    const messageId = uuid()
    const connection = await this.connectionService.getById(this.agentContext, connectionId)
    try {
      const { message: drpcMessage, record: drpcMessageRecord } = await this.drpcMessageService.createRequestMessage(this.agentContext, request, connection, messageId)
      await this.sendDRPCMessage(connection, drpcMessage, drpcMessageRecord)
    } catch {
      throw new Error('Invalid DRPC Request')
    }
    return new Promise((resolve) => {
      const listener = ({ message, removeListener }: { message: DRPCRequestMessage | DRPCResponseMessage, removeListener: () => void }) => {
        if (message instanceof DRPCResponseMessage && message.threadId === messageId) {
          removeListener()

          resolve(message.response)
        }
      }

      this.drpcMessageService.createMessageListener(listener)
    })
  }

  private async sendDRPCResponse(connectionId: string, threadId: string, response: {} | DRPCResponseObject | (DRPCRequestObject | {})[]): Promise<void> {
    const connection = await this.connectionService.getById(this.agentContext, connectionId)
    const { message: drpcMessage, record: drpcMessageRecord } = await this.drpcMessageService.createResponseMessage(this.agentContext, response, connection)
    drpcMessage.setThread({ threadId })
    await this.sendDRPCMessage(connection, drpcMessage, drpcMessageRecord)

  }

  private async sendDRPCMessage(connection: ConnectionRecord, message: DRPCRequestMessage | DRPCResponseMessage, messageRecord: DRPCMessageRecord): Promise<void> {
    const outboundMessageContext = new OutboundMessageContext(message, {
      agentContext: this.agentContext,
      connection,
      associatedRecord: messageRecord,
    })

    await this.messageSender.sendMessage(outboundMessageContext)
  }

  public createDRPCMethodHandler(method: string, handler: (message: DRPCRequestObject) => Promise<DRPCResponseObject | {}>) {
    this.drpcMethodHandlers.set(method, handler)
  }

  public removeDRPCMethodHandler(method: string) {
    this.drpcMethodHandlers.delete(method)
  }

  private registerMessageHandlers(messageHandlerRegistry: MessageHandlerRegistry) {
    messageHandlerRegistry.registerMessageHandler(new DRPCMessageHandler(this.drpcMessageService))
  }
}
