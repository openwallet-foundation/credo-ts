import { AgentContext } from '@credo-ts/core'
import type {
  AddMessageOptions,
  GetAvailableMessageCountOptions,
  RemoveMessagesOptions,
  TakeFromQueueOptions,
} from './QueueTransportRepositoryOptions'
import type { QueuedMessage } from './QueuedMessage'

export interface QueueTransportRepository {
  getAvailableMessageCount(
    agentContext: AgentContext,
    options: GetAvailableMessageCountOptions
  ): number | Promise<number>
  takeFromQueue(agentContext: AgentContext, options: TakeFromQueueOptions): QueuedMessage[] | Promise<QueuedMessage[]>
  addMessage(agentContext: AgentContext, options: AddMessageOptions): string | Promise<string>
  removeMessages(agentContext: AgentContext, options: RemoveMessagesOptions): void | Promise<void>
}
