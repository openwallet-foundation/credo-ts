import type { AgentMessage } from '../agent/AgentMessage'
import type { BaseRecord } from '../storage/BaseRecord'

import { AriesFrameworkError } from './AriesFrameworkError'

export class MessageSendingError extends AriesFrameworkError {
  public agentMessage: AgentMessage
  public associatedRecord?: BaseRecord
  public constructor(
    message: string,
    {
      agentMessage,
      associatedRecord,
      cause,
    }: { agentMessage: AgentMessage; associatedRecord?: BaseRecord; cause?: Error }
  ) {
    super(message, { cause })
    this.agentMessage = agentMessage
    this.associatedRecord = associatedRecord
  }
}
