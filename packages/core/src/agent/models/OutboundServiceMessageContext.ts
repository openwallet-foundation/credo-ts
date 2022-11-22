import type { Key } from '../../crypto'
import type { ResolvedDidCommService } from '../../modules/didcomm'
import type { BaseRecord } from '../../storage/BaseRecord'
import type { AgentMessage } from '../AgentMessage'
import type { AgentContext } from '../context'

export interface OutboundServiceMessageContextParams {
  agentContext: AgentContext
  associatedRecord?: BaseRecord<any, any, any>
  service: ResolvedDidCommService
  senderKey: Key
}

export class OutboundServiceMessageContext<T extends AgentMessage = AgentMessage> {
  public message: T
  public senderKey: Key
  public service: ResolvedDidCommService
  public associatedRecord?: BaseRecord<any, any, any>
  public readonly agentContext: AgentContext

  public constructor(message: T, context: OutboundServiceMessageContextParams) {
    this.message = message
    this.service = context.service
    this.senderKey = context.senderKey
    this.associatedRecord = context.associatedRecord
    this.agentContext = context.agentContext
  }

  public toJSON() {
    return {
      message: this.message,
      senderKey: this.senderKey,
      service: this.service,
      associatedRecord: this.associatedRecord,
      agentContext: this.agentContext.toJSON(),
    }
  }
}
