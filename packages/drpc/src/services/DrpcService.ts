import type { DrpcRequestStateChangedEvent } from '../DrpcRequestEvents'
import type { DrpcResponseStateChangedEvent } from '../DrpcResponseEvents'
import type { DrpcRequest, DrpcResponse } from '../messages'
import type { AgentContext, InboundMessageContext, Query } from '@credo-ts/core'

import { EventEmitter, injectable } from '@credo-ts/core'

import { DrpcRequestEventTypes } from '../DrpcRequestEvents'
import { DrpcResponseEventTypes } from '../DrpcResponseEvents'
import { DrpcRole } from '../DrpcRole'
import { DrpcState } from '../DrpcState'
import { DrpcRequestMessage, DrpcResponseMessage, isValidDrpcRequest, isValidDrpcResponse } from '../messages'
import { DrpcMessageRecord, DrpcMessageRepository } from '../repository'

@injectable()
export class DrpcService {
  private drpcMessageRepository: DrpcMessageRepository
  private eventEmitter: EventEmitter

  public constructor(drpcMessageRepository: DrpcMessageRepository, eventEmitter: EventEmitter) {
    this.drpcMessageRepository = drpcMessageRepository
    this.eventEmitter = eventEmitter
  }

  public async createRequestMessage(agentContext: AgentContext, message: DrpcRequest, connectionId: string) {
    const drpcMessage = new DrpcRequestMessage({ request: message })

    const drpcMessageRecord = new DrpcMessageRecord({
      message,
      connectionId,
      state: DrpcState.RequestSent,
      threadId: drpcMessage.threadId,
      role: DrpcRole.Client,
    })

    await this.drpcMessageRepository.save(agentContext, drpcMessageRecord)
    this.emitStateChangedEvent(agentContext, drpcMessageRecord)

    return { message: drpcMessage, record: drpcMessageRecord }
  }

  public async createResponseMessage(agentContext: AgentContext, message: DrpcResponse, drpcRecord: DrpcMessageRecord) {
    const drpcMessage = new DrpcResponseMessage({ response: message, threadId: drpcRecord.threadId })

    drpcRecord.assertState(DrpcState.RequestRecieved)

    drpcRecord.message = message

    await this.updateState(agentContext, drpcRecord, DrpcState.Completed)

    return { message: drpcMessage, record: drpcRecord }
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

  public async recieveResponse(messageContext: InboundMessageContext<DrpcResponseMessage>) {
    const connection = messageContext.assertReadyConnection()
    const drpcMessageRecord = await this.findByThreadAndConnectionId(
      messageContext.agentContext,
      connection.id,
      messageContext.message.threadId
    )

    if (!drpcMessageRecord) {
      throw new Error('DRPC message record not found')
    }

    drpcMessageRecord.assertRole(DrpcRole.Client)
    drpcMessageRecord.assertState(DrpcState.RequestSent)
    drpcMessageRecord.message = messageContext.message.response

    await this.updateState(messageContext.agentContext, drpcMessageRecord, DrpcState.Completed)
    return drpcMessageRecord
  }

  public async recieveRequest(messageContext: InboundMessageContext<DrpcRequestMessage>) {
    const connection = messageContext.assertReadyConnection()
    const record = await this.findByThreadAndConnectionId(
      messageContext.agentContext,
      connection.id,
      messageContext.message.threadId
    )

    if (record) {
      throw new Error('DRPC message record already exists')
    }
    const drpcMessageRecord = new DrpcMessageRecord({
      message: messageContext.message.request,
      connectionId: connection.id,
      role: DrpcRole.Server,
      state: DrpcState.RequestRecieved,
      threadId: messageContext.message.id,
    })

    await this.drpcMessageRepository.save(messageContext.agentContext, drpcMessageRecord)
    this.emitStateChangedEvent(messageContext.agentContext, drpcMessageRecord)
    return drpcMessageRecord
  }

  private emitStateChangedEvent(agentContext: AgentContext, drpcMessageRecord: DrpcMessageRecord) {
    if (
      isValidDrpcRequest(drpcMessageRecord.message) ||
      (Array.isArray(drpcMessageRecord.message) &&
        drpcMessageRecord.message.length > 0 &&
        isValidDrpcRequest(drpcMessageRecord.message[0]))
    ) {
      this.eventEmitter.emit<DrpcRequestStateChangedEvent>(agentContext, {
        type: DrpcRequestEventTypes.DrpcRequestStateChanged,
        payload: { drpcMessageRecord: drpcMessageRecord.clone() },
      })
    } else if (
      isValidDrpcResponse(drpcMessageRecord.message) ||
      (Array.isArray(drpcMessageRecord.message) &&
        drpcMessageRecord.message.length > 0 &&
        isValidDrpcResponse(drpcMessageRecord.message[0]))
    ) {
      this.eventEmitter.emit<DrpcResponseStateChangedEvent>(agentContext, {
        type: DrpcResponseEventTypes.DrpcResponseStateChanged,
        payload: { drpcMessageRecord: drpcMessageRecord.clone() },
      })
    }
  }

  private async updateState(agentContext: AgentContext, drpcRecord: DrpcMessageRecord, newState: DrpcState) {
    drpcRecord.state = newState
    await this.drpcMessageRepository.update(agentContext, drpcRecord)

    this.emitStateChangedEvent(agentContext, drpcRecord)
  }

  public findByThreadAndConnectionId(
    agentContext: AgentContext,
    connectionId: string,
    threadId: string
  ): Promise<DrpcMessageRecord | null> {
    return this.drpcMessageRepository.findSingleByQuery(agentContext, {
      connectionId,
      threadId,
    })
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
