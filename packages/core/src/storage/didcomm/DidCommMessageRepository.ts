import type { AgentMessage } from '../../agent/AgentMessage'
import type { JsonObject } from '../../types'
import type { DidCommMessageRole } from './DidCommMessageRole'

import { inject, scoped, Lifecycle } from 'tsyringe'

import { InjectionSymbols } from '../../constants'
import { Repository } from '../Repository'
import { StorageService } from '../StorageService'

import { DidCommMessageRecord } from './DidCommMessageRecord'

@scoped(Lifecycle.ContainerScoped)
export class DidCommMessageRepository extends Repository<DidCommMessageRecord> {
  public constructor(@inject(InjectionSymbols.StorageService) storageService: StorageService<DidCommMessageRecord>) {
    super(DidCommMessageRecord, storageService)
  }

  public async saveAgentMessage({ role, agentMessage, associatedRecordId }: SaveAgentMessageOptions) {
    const didCommMessageRecord = new DidCommMessageRecord({
      message: agentMessage.toJSON() as JsonObject,
      role,
      associatedRecordId,
    })

    await this.save(didCommMessageRecord)
  }
  public async getAll(): Promise<DidCommMessageRecord[]> {
    return await this.getAll()
  }

  public async saveOrUpdateAgentMessage(options: SaveAgentMessageOptions) {
    const record = await this.findSingleByQuery({
      associatedRecordId: options.associatedRecordId,
      messageType: options.agentMessage.type,
    })

    if (record) {
      record.message = options.agentMessage.toJSON() as JsonObject
      record.role = options.role
      await this.update(record)
      return
    }

    await this.saveAgentMessage(options)
  }

  public async saveOrUpdateAgentMessage(options: SaveAgentMessageOptions) {
    const record = await this.findSingleByQuery({
      associatedRecordId: options.associatedRecordId,
      messageType: options.agentMessage.type,
    })

    if (record) {
      record.message = options.agentMessage.toJSON() as JsonObject
      record.role = options.role
      await this.update(record)
      return
    }

    await this.saveAgentMessage(options)
  }

  public async getAgentMessage<MessageClass extends typeof AgentMessage = typeof AgentMessage>({
    associatedRecordId,
    messageClass,
  }: GetAgentMessageOptions<MessageClass>): Promise<InstanceType<MessageClass>> {
    const record = await this.getSingleByQuery({
      associatedRecordId,
      messageType: messageClass.type,
    })

    return record.getMessageInstance(messageClass)
  }
  public async findAgentMessage<MessageClass extends typeof AgentMessage = typeof AgentMessage>({
    associatedRecordId,
    messageClass,
  }: GetAgentMessageOptions<MessageClass>): Promise<InstanceType<MessageClass> | null> {
    const record = await this.findSingleByQuery({
      associatedRecordId,
      messageType: messageClass.type,
    })

    return record?.getMessageInstance(messageClass) ?? null
  }
}

export interface SaveAgentMessageOptions {
  role: DidCommMessageRole
  agentMessage: AgentMessage
  associatedRecordId: string
}

export interface GetAgentMessageOptions<MessageClass extends typeof AgentMessage> {
  associatedRecordId: string
  messageClass: MessageClass
}
