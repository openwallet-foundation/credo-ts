import type { DRPCMessageRecord } from './repository/DRPCMessageRecord'
import type { Query } from '../../storage/StorageService'

import { AgentContext } from '../../agent'
import { MessageHandlerRegistry } from '../../agent/MessageHandlerRegistry'
import { MessageSender } from '../../agent/MessageSender'
import { OutboundMessageContext } from '../../agent/models'
import { injectable } from '../../plugins'
import { ConnectionService } from '../connections'

import { DRPCMessageHandler } from './handlers'
import { DRPCMessageService } from './services'
import { DRPCErrorCode, DRPCRequestMessage, DRPCRequestObject, DRPCResponseMessage, DRPCResponseObject } from './messages'
import { DRPCMessageRole } from './DRPCMessageRole'
import { DRPCMessageStateChangedEvent } from './DRPCMessageEvents'

@injectable()
export class DRPCMessagesApi {
  private drpcMessageService: DRPCMessageService
  private drpcMethodHandlers: Map<string, (message: DRPCRequestObject) => Promise<DRPCResponseObject>> = new Map()
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
    this.drpcMessageService.createMessageListener(({ message, drpcMessageRecord }) => {
      console.log(`Received DRPC message: ${JSON.stringify(message)} ${JSON.stringify(drpcMessageRecord)}`)

      if (message instanceof DRPCRequestMessage && drpcMessageRecord.role === DRPCMessageRole.Receiver) {
        const handler = this.drpcMethodHandlers.get(message.request.method);
        if (!handler) {
          const notFound = this.sendDidcomMessage(drpcMessageRecord.connectionId, { jsonrpc: '2.0', id: message.request.id, error: { code: DRPCErrorCode.METHOD_NOT_FOUND, message: `Method not found` } })
          return
        }
        handler(message.request)
          .then((response) => {
            let responseContent: DRPCRequestObject | {} = response
            // no id means it's a notification
            if (!message.request.id) {
              responseContent = {}
            }
            this.sendDidcomMessage(drpcMessageRecord.connectionId, responseContent)
          })
          .catch((error) => this.sendDidcomMessage(drpcMessageRecord.connectionId, { jsonrpc: '2.0', id: message.request.id, error: { code: DRPCErrorCode.INTERNAL_ERROR, message: 'Internal error', data: error.message } }))
      }
    })
  }

  public sendDRPCRequest(connectionId: string, request: DRPCRequestObject): Promise<DRPCResponseMessage> {
    this.sendDidcomMessage(connectionId, request)
    return new Promise((resolve) => {
      const listener = ({ message, removeListener }: { message: DRPCRequestMessage | DRPCResponseMessage, removeListener: () => void }) => {
        if (message instanceof DRPCResponseMessage && 'id' in message.response && message.response.id === request.id) {
          removeListener()

          resolve(message)
        }
      }

      this.drpcMessageService.createMessageListener(listener)
    })
  }

  /**
   * Send a message to an active connection
   *
   * @param connectionId Connection Id
   * @param message Message contents
   * @throws {RecordNotFoundError} If connection is not found
   * @throws {MessageSendingError} If message is undeliverable
   * @returns the created record
   */
  private async sendDidcomMessage(connectionId: string, message: DRPCRequestObject | DRPCResponseObject | {}) {
    const connection = await this.connectionService.getById(this.agentContext, connectionId)

    const { message: drpcMessage, record: drpcMessageRecord } = await this.drpcMessageService.createMessage(
      this.agentContext,
      message,
      connection,
    )
    console.log(`drpc message: ${JSON.stringify(drpcMessage)} ${JSON.stringify(drpcMessageRecord)}`)
    const outboundMessageContext = new OutboundMessageContext(drpcMessage, {
      agentContext: this.agentContext,
      connection,
      associatedRecord: drpcMessageRecord,
    })

    await this.messageSender.sendMessage(outboundMessageContext)
    return drpcMessageRecord
  }

  public createDRPCMethodHandler(method: string, handler: (message: DRPCRequestObject) => Promise<DRPCResponseObject>) {
    this.drpcMethodHandlers.set(method, handler)
  }

  public removeDRPCMethodHandler(method: string) {
    this.drpcMethodHandlers.delete(method)
  }

  /**
   * Retrieve all basic messages matching a given query
   *
   * @param query The query
   * @returns array containing all matching records
   */
  private async findAllByQuery(query: Query<DRPCMessageRecord>) {
    return this.drpcMessageService.findAllByQuery(this.agentContext, query)
  }

  /**
   * Retrieve a basic message record by id
   *
   * @param drpcMessageRecordId The basic message record id
   * @throws {RecordNotFoundError} If no record is found
   * @return The basic message record
   *
   */
  private async getById(drpcMessageRecordId: string) {
    return this.drpcMessageService.getById(this.agentContext, drpcMessageRecordId)
  }

  /**
   * Delete a basic message record by id
   *
   * @param connectionId the basic message record id
   * @throws {RecordNotFoundError} If no record is found
   */
  private async deleteById(drpcMessageRecordId: string) {
    await this.drpcMessageService.deleteById(this.agentContext, drpcMessageRecordId)
  }

  private registerMessageHandlers(messageHandlerRegistry: MessageHandlerRegistry) {
    console.log('Registering DRPC message handlers')
    messageHandlerRegistry.registerMessageHandler(new DRPCMessageHandler(this.drpcMessageService))
  }
}
