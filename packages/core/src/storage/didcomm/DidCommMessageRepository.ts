import type { AgentMessage } from '../../agent/AgentMessage'
import type { JsonMap } from '../../types'
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

  public async saveAgentMessage({
    role,
    agentMessage,
    connectionId,
  }: {
    role: DidCommMessageRole
    agentMessage: AgentMessage
    connectionId?: string
  }) {
    const didCommMessageRecord = new DidCommMessageRecord({
      message: agentMessage.toJSON() as JsonMap,
      role,
      connectionId,
    })

    await this.save(didCommMessageRecord)
  }

  public async getAgentMessage<MessageClass extends typeof AgentMessage = typeof AgentMessage>({
    threadId,
    messageClass,
  }: {
    threadId: string
    messageClass: MessageClass
  }): Promise<InstanceType<MessageClass>> {
    const record = await this.getSingleByQuery({
      threadId,
      messageType: messageClass.type,
    })

    return record.getMessageInstance(messageClass)
  }
}
