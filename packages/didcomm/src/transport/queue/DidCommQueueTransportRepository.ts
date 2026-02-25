import { AgentContext } from '@credo-ts/core'
import type { QueuedDidCommMessage } from './QueuedDidCommMessage'
import type {
  AddMessageOptions,
  GetAvailableMessageCountOptions,
  RemoveMessagesOptions,
  TakeFromQueueOptions,
} from './QueueTransportRepositoryOptions'

export interface DidCommQueueTransportRepository {
  getAvailableMessageCount(
    agentContext: AgentContext,
    options: GetAvailableMessageCountOptions
  ): number | Promise<number>
  takeFromQueue(
    agentContext: AgentContext,
    options: TakeFromQueueOptions
  ): QueuedDidCommMessage[] | Promise<QueuedDidCommMessage[]>
  addMessage(agentContext: AgentContext, options: AddMessageOptions): string | Promise<string>
  removeMessages(agentContext: AgentContext, options: RemoveMessagesOptions): void | Promise<void>
}
