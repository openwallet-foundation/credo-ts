/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Key } from '../../crypto'
import type { ConnectionRecord } from '../../modules/connections'
import type { ResolvedDidCommService } from '../../modules/didcomm'
import type { OutOfBandRecord } from '../../modules/oob'
import type { BaseRecord } from '../../storage/BaseRecord'
import type { AgentMessage } from '../AgentMessage'
import type { AgentContext } from '../context'
import type { InboundMessageContext } from './InboundMessageContext'

import { AriesFrameworkError } from '../../error'

export interface ServiceMessageParams {
  senderKey: Key
  service: ResolvedDidCommService
  returnRoute?: boolean
}

export interface OutboundMessageContextParams {
  agentContext: AgentContext
  inboundMessageContext?: InboundMessageContext
  associatedRecord?: BaseRecord<any, any, any>
  connection?: ConnectionRecord
  serviceParams?: ServiceMessageParams
  outOfBand?: OutOfBandRecord
  sessionId?: string
}

export class OutboundMessageContext<T extends AgentMessage = AgentMessage> {
  public message: T
  public sessionIdFromInbound?: string | undefined
  public connection?: ConnectionRecord
  public serviceParams?: ServiceMessageParams
  public outOfBand?: OutOfBandRecord
  public associatedRecord?: BaseRecord<any, any, any>
  public sessionId?: string
  public readonly agentContext: AgentContext

  public constructor(message: T, context: OutboundMessageContextParams, inboundContext?: InboundMessageContext) {
    this.message = message
    this.sessionIdFromInbound = inboundContext?.sessionId ? inboundContext.sessionId : undefined
    this.connection = context.connection
    this.sessionId = context.sessionId
    this.outOfBand = context.outOfBand
    this.serviceParams = context.serviceParams
    this.associatedRecord = context.associatedRecord
    this.agentContext = context.agentContext
  }

  /**
   * Assert the outbound message has a ready connection associated with it.
   *
   * @throws {AriesFrameworkError} if there is no connection or the connection is not ready
   */
  public assertReadyConnection(): ConnectionRecord {
    if (!this.connection) {
      throw new AriesFrameworkError(`No connection associated with outgoing message ${this.message.type}`)
    }

    // Make sure connection is ready
    this.connection.assertReady()

    return this.connection
  }

  public isOutboundServiceMessage(): boolean {
    return this.serviceParams?.service !== undefined
  }

  public toJSON() {
    return {
      message: this.message,
      outOfBand: this.outOfBand,
      sessionIdFromInbound: this.sessionIdFromInbound,
      associatedRecord: this.associatedRecord,
      sessionId: this.sessionId,
      serviceParams: this.serviceParams,
      agentContext: this.agentContext.toJSON(),
      connection: this.connection,
    }
  }
}
