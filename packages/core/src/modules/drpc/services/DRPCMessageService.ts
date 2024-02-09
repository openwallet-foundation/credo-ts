import type { AgentContext } from '../../../agent'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { Query } from '../../../storage/StorageService'
import type { ConnectionRecord } from '../../connections/repository/ConnectionRecord'
import type { DRPCMessageStateChangedEvent } from '../DRPCMessageEvents'

import { EventEmitter } from '../../../agent/EventEmitter'
import { injectable } from '../../../plugins'
import { DRPCMessageEventTypes } from '../DRPCMessageEvents'
import { DRPCMessageRole } from '../DRPCMessageRole'
import { DRPCRequestMessage, DRPCRequestObject, DRPCResponseMessage, DRPCResponseObject } from '../messages'
import { DRPCMessageRecord, DRPCMessageRepository } from '../repository'

@injectable()
export class DRPCMessageService {
  private drpcMessageRepository: DRPCMessageRepository
  private eventEmitter: EventEmitter

  public constructor(drpcMessageRepository: DRPCMessageRepository, eventEmitter: EventEmitter) {
    this.drpcMessageRepository = drpcMessageRepository
    this.eventEmitter = eventEmitter
  }

  public async createRequestMessage(
    agentContext: AgentContext,
    message: DRPCRequestObject | DRPCRequestObject[],
    connectionRecord: ConnectionRecord,
    messageId?: string
  ) {
    const drpcMessage = new DRPCRequestMessage({ request: message }, messageId)

    const drpcMessageRecord = new DRPCMessageRecord({
      content: drpcMessage,
      connectionId: connectionRecord.id,
      role: DRPCMessageRole.Sender,
    })

    await this.drpcMessageRepository.save(agentContext, drpcMessageRecord)
    this.emitStateChangedEvent(agentContext, drpcMessageRecord, drpcMessage)

    return { message: drpcMessage, record: drpcMessageRecord }
  }

  public async createResponseMessage(
    agentContext: AgentContext,
    message: {} | DRPCResponseObject | (DRPCResponseObject | {})[],
    connectionRecord: ConnectionRecord,
  ) {

    const drpcMessage = new DRPCResponseMessage({ response: message })

    const drpcMessageRecord = new DRPCMessageRecord({
      content: drpcMessage,
      connectionId: connectionRecord.id,
      role: DRPCMessageRole.Sender,
    })

    await this.drpcMessageRepository.save(agentContext, drpcMessageRecord)
    this.emitStateChangedEvent(agentContext, drpcMessageRecord, drpcMessage)

    return { message: drpcMessage, record: drpcMessageRecord }
  }

  public createMessageListener(callback: (params: { message: DRPCRequestMessage | DRPCResponseMessage, drpcMessageRecord: DRPCMessageRecord, removeListener: () => void }) => void | Promise<void>) {
    const listener = async (event: DRPCMessageStateChangedEvent) => {
      const { message, drpcMessageRecord } = event.payload
      callback({ message, drpcMessageRecord, removeListener: () => this.eventEmitter.off(DRPCMessageEventTypes.DRPCMessageStateChanged, listener) })
    }
    this.eventEmitter.on(DRPCMessageEventTypes.DRPCMessageStateChanged, listener)
  }

  /**
   * @todo use connection from message context
   */
  public async save({ message, agentContext }: InboundMessageContext<DRPCResponseMessage | DRPCRequestMessage>, connection: ConnectionRecord) {
    const drpcMessageRecord = new DRPCMessageRecord({
      content: message,
      connectionId: connection.id,
      role: DRPCMessageRole.Receiver,
    })

    await this.drpcMessageRepository.save(agentContext, drpcMessageRecord)
    this.emitStateChangedEvent(agentContext, drpcMessageRecord, message)
  }

  private emitStateChangedEvent(
    agentContext: AgentContext,
    drpcMessageRecord: DRPCMessageRecord,
    drpcMessage: DRPCRequestMessage | DRPCResponseMessage
  ) {
    this.eventEmitter.emit<DRPCMessageStateChangedEvent>(agentContext, {
      type: DRPCMessageEventTypes.DRPCMessageStateChanged,
      payload: { message: drpcMessage, drpcMessageRecord: drpcMessageRecord.clone() },
    })
  }

  public async findAllByQuery(agentContext: AgentContext, query: Query<DRPCMessageRecord>) {
    return this.drpcMessageRepository.findByQuery(agentContext, query)
  }

  public async getById(agentContext: AgentContext, drpcMessageRecordId: string) {
    return this.drpcMessageRepository.getById(agentContext, drpcMessageRecordId)
  }

  public async deleteById(agentContext: AgentContext, drpcMessageRecordId: string) {
    const drpcMessageRecord = await this.getById(agentContext, drpcMessageRecordId)
    return this.drpcMessageRepository.delete(agentContext, drpcMessageRecord)
  }
}
