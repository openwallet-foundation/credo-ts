import type { DRPCRequestStateChangedEvent } from '../DRPCRequestEvents'
import type { DRPCResponseStateChangedEvent } from '../DRPCResponseEvents'
import type { DRPCRequest, DRPCResponse } from '../messages'
import type { AgentContext, InboundMessageContext, Query, ConnectionRecord } from '@credo-ts/core'

import { EventEmitter, injectable } from '@credo-ts/core'

import { DRPCMessageRole } from '../DRPCMessageRole'
import { DRPCRequestEventTypes } from '../DRPCRequestEvents'
import { DRPCResponseEventTypes } from '../DRPCResponseEvents'
import { DRPCRequestMessage, DRPCResponseMessage } from '../messages'
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
    message: DRPCRequest,
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
    this.emitStateChangedEvent(agentContext, drpcMessageRecord)

    return { message: drpcMessage, record: drpcMessageRecord }
  }

  public async createResponseMessage(
    agentContext: AgentContext,
    message: DRPCResponse,
    connectionRecord: ConnectionRecord
  ) {
    const drpcMessage = new DRPCResponseMessage({ response: message })

    const drpcMessageRecord = new DRPCMessageRecord({
      content: drpcMessage,
      connectionId: connectionRecord.id,
      role: DRPCMessageRole.Sender,
    })

    await this.drpcMessageRepository.save(agentContext, drpcMessageRecord)
    this.emitStateChangedEvent(agentContext, drpcMessageRecord)

    return { message: drpcMessage, record: drpcMessageRecord }
  }

  public createRequestListener(
    callback: (params: { drpcMessageRecord: DRPCMessageRecord; removeListener: () => void }) => void | Promise<void>
  ) {
    const listener = async (event: DRPCRequestStateChangedEvent) => {
      const { drpcMessageRecord } = event.payload
      await callback({
        drpcMessageRecord,
        removeListener: () => this.eventEmitter.off(DRPCRequestEventTypes.DRPCRequestStateChanged, listener),
      })
    }
    this.eventEmitter.on(DRPCRequestEventTypes.DRPCRequestStateChanged, listener)
  }

  public createResponseListener(
    callback: (params: { drpcMessageRecord: DRPCMessageRecord; removeListener: () => void }) => void | Promise<void>
  ) {
    const listener = async (event: DRPCResponseStateChangedEvent) => {
      const { drpcMessageRecord } = event.payload
      await callback({
        drpcMessageRecord,
        removeListener: () => this.eventEmitter.off(DRPCResponseEventTypes.DRPCResponseStateChanged, listener),
      })
    }
    this.eventEmitter.on(DRPCResponseEventTypes.DRPCResponseStateChanged, listener)
  }

  public async save(
    { message, agentContext }: InboundMessageContext<DRPCResponseMessage | DRPCRequestMessage>,
    connection: ConnectionRecord
  ) {
    const drpcMessageRecord = new DRPCMessageRecord({
      content: message,
      connectionId: connection.id,
      role: DRPCMessageRole.Receiver,
    })

    await this.drpcMessageRepository.save(agentContext, drpcMessageRecord)
    this.emitStateChangedEvent(agentContext, drpcMessageRecord)
  }

  private emitStateChangedEvent(agentContext: AgentContext, drpcMessageRecord: DRPCMessageRecord) {
    if ('request' in drpcMessageRecord.content) {
      this.eventEmitter.emit<DRPCRequestStateChangedEvent>(agentContext, {
        type: DRPCRequestEventTypes.DRPCRequestStateChanged,
        payload: { drpcMessageRecord: drpcMessageRecord.clone() },
      })
    } else {
      this.eventEmitter.emit<DRPCResponseStateChangedEvent>(agentContext, {
        type: DRPCResponseEventTypes.DRPCResponseStateChanged,
        payload: { drpcMessageRecord: drpcMessageRecord.clone() },
      })
    }
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
