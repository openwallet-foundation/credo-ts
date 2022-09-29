import type { EncryptedMessage } from '../agent/didcomm'
import type { Logger } from '../logger'
import type { MessageRepository } from './MessageRepository'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../agent/AgentConfig'

@scoped(Lifecycle.ContainerScoped)
export class InMemoryMessageRepository implements MessageRepository {
  private logger: Logger
  private messages: { [key: string]: EncryptedMessage[] } = {}

  public constructor(agentConfig: AgentConfig) {
    this.logger = agentConfig.logger
  }

  public takeFromQueue(connectionId: string, limit?: number) {
    if (!this.messages[connectionId]) {
      return []
    }

    const messagesToTake = limit ?? this.messages[connectionId].length
    this.logger.debug(`Taking ${messagesToTake} messages from queue for connection ${connectionId}`)

    return this.messages[connectionId].splice(0, messagesToTake)
  }

  public add(connectionId: string, payload: EncryptedMessage) {
    if (!this.messages[connectionId]) {
      this.messages[connectionId] = []
    }

    this.messages[connectionId].push(payload)
  }
}
