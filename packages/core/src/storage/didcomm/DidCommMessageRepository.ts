import type { AgentMessage, ConstructableAgentMessage } from '../../agent/AgentMessage'
import type { JsonObject } from '../../types'
import type { DidCommMessageRole } from './DidCommMessageRole'

import { inject, scoped, Lifecycle } from 'tsyringe'

import { InjectionSymbols } from '../../constants'
import { parseMessageType } from '../../utils/messageType'
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

  public async saveOrUpdateAgentMessage(options: SaveAgentMessageOptions) {
    const parsedMessageType = parseMessageType(options.agentMessage.type)
    const record = await this.findSingleByQuery({
      associatedRecordId: options.associatedRecordId,
      messageName: parsedMessageType.messageName,
      protocolName: parsedMessageType.protocolName,
      protocolMajorVersion: String(parsedMessageType.protocolMajorVersion),
    })

    if (record) {
      record.message = options.agentMessage.toJSON() as JsonObject
      record.role = options.role
      await this.update(record)
      return
    }

    await this.saveAgentMessage(options)
  }

  public async getAgentMessage<MessageClass extends ConstructableAgentMessage = ConstructableAgentMessage>({
    associatedRecordId,
    messageClass,
  }: GetAgentMessageOptions<MessageClass>): Promise<InstanceType<MessageClass>> {
    const record = await this.getSingleByQuery({
      associatedRecordId,
      messageName: messageClass.type.messageName,
      protocolName: messageClass.type.protocolName,
      protocolMajorVersion: String(messageClass.type.protocolMajorVersion),
    })

    return record.getMessageInstance(messageClass)
  }
  public async findAgentMessage<MessageClass extends ConstructableAgentMessage = ConstructableAgentMessage>({
    associatedRecordId,
    messageClass,
  }: GetAgentMessageOptions<MessageClass>): Promise<InstanceType<MessageClass> | null> {
    const record = await this.findSingleByQuery({
      associatedRecordId,
      messageName: messageClass.type.messageName,
      protocolName: messageClass.type.protocolName,
      protocolMajorVersion: String(messageClass.type.protocolMajorVersion),
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
