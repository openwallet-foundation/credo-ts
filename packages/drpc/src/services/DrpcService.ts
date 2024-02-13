import type { DrpcRequestStateChangedEvent } from '../DrpcRequestEvents'
import type { DrpcResponseStateChangedEvent } from '../DrpcResponseEvents'
import type { DrpcRequest, DrpcResponse } from '../messages'
import type { AgentContext, InboundMessageContext, Query, ConnectionRecord } from '@credo-ts/core'

import { EventEmitter, injectable } from '@credo-ts/core'

import { DrpcRequestEventTypes } from '../DrpcRequestEvents'
import { DrpcResponseEventTypes } from '../DrpcResponseEvents'
import { DrpcRole } from '../DrpcRole'
import { DrpcRequestMessage, DrpcResponseMessage } from '../messages'
import { DrpcMessageRecord, DrpcMessageRepository } from '../repository'

@injectable()
export class DrpcService {
  private drpcMessageRepository: DrpcMessageRepository
  private eventEmitter: EventEmitter

  public constructor(drpcMessageRepository: DrpcMessageRepository, eventEmitter: EventEmitter) {
    this.drpcMessageRepository = drpcMessageRepository
    this.eventEmitter = eventEmitter
  }

  public async createRequestMessage(
    agentContext: AgentContext,
    message: DrpcRequest,
    connectionRecord: ConnectionRecord,
    messageId?: string
  ) {
    const drpcMessage = new DrpcRequestMessage({ request: message }, messageId)

    const drpcMessageRecord = new DrpcMessageRecord({
      content: drpcMessage,
      connectionId: connectionRecord.id,
      role: DrpcRole.Sender,
    })

    await this.drpcMessageRepository.save(agentContext, drpcMessageRecord)
    this.emitStateChangedEvent(agentContext, drpcMessageRecord)

    return { message: drpcMessage, record: drpcMessageRecord }
  }

  public async createResponseMessage(
    agentContext: AgentContext,
    message: DrpcResponse,
    connectionRecord: ConnectionRecord
  ) {
    const drpcMessage = new DrpcResponseMessage({ response: message })

    const drpcMessageRecord = new DrpcMessageRecord({
      content: drpcMessage,
      connectionId: connectionRecord.id,
      role: DrpcRole.Sender,
    })

    await this.drpcMessageRepository.save(agentContext, drpcMessageRecord)
    this.emitStateChangedEvent(agentContext, drpcMessageRecord)

    return { message: drpcMessage, record: drpcMessageRecord }
  }

  public createRequestListener(
    callback: (params: { drpcMessageRecord: DrpcMessageRecord; removeListener: () => void }) => void | Promise<void>
  ) {
    const listener = async (event: DrpcRequestStateChangedEvent) => {
      const { drpcMessageRecord } = event.payload
      await callback({
        drpcMessageRecord,
        removeListener: () => this.eventEmitter.off(DrpcRequestEventTypes.DrpcRequestStateChanged, listener),
      })
    }
    this.eventEmitter.on(DrpcRequestEventTypes.DrpcRequestStateChanged, listener)
  }

  public createResponseListener(
    callback: (params: { drpcMessageRecord: DrpcMessageRecord; removeListener: () => void }) => void | Promise<void>
  ) {
    const listener = async (event: DrpcResponseStateChangedEvent) => {
      const { drpcMessageRecord } = event.payload
      await callback({
        drpcMessageRecord,
        removeListener: () => this.eventEmitter.off(DrpcResponseEventTypes.DrpcResponseStateChanged, listener),
      })
    }
    this.eventEmitter.on(DrpcResponseEventTypes.DrpcResponseStateChanged, listener)
  }

  public async save(
    { message, agentContext }: InboundMessageContext<DrpcResponseMessage | DrpcRequestMessage>,
    connection: ConnectionRecord
  ) {
    const drpcMessageRecord = new DrpcMessageRecord({
      content: message,
      connectionId: connection.id,
      role: DrpcRole.Receiver,
    })

    await this.drpcMessageRepository.save(agentContext, drpcMessageRecord)
    this.emitStateChangedEvent(agentContext, drpcMessageRecord)
  }

  private emitStateChangedEvent(agentContext: AgentContext, drpcMessageRecord: DrpcMessageRecord) {
    if ('request' in drpcMessageRecord.content) {
      this.eventEmitter.emit<DrpcRequestStateChangedEvent>(agentContext, {
        type: DrpcRequestEventTypes.DrpcRequestStateChanged,
        payload: { drpcMessageRecord: drpcMessageRecord.clone() },
      })
    } else {
      this.eventEmitter.emit<DrpcResponseStateChangedEvent>(agentContext, {
        type: DrpcResponseEventTypes.DrpcResponseStateChanged,
        payload: { drpcMessageRecord: drpcMessageRecord.clone() },
      })
    }
  }

  public async findAllByQuery(agentContext: AgentContext, query: Query<DrpcMessageRecord>) {
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
