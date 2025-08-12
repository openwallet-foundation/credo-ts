import type { AgentContext, BaseRecord, Kms, ResolvedDidCommService } from '@credo-ts/core'
import type { DidCommMessage } from '../DidCommMessage'
import type { ConnectionRecord } from '../modules/connections/repository'
import type { OutOfBandRecord } from '../modules/oob'
import type { InboundDidCommMessageContext } from './InboundDidCommMessageContext'

import { CredoError } from '@credo-ts/core'

export interface ServiceMessageParams {
  senderKey: Kms.PublicJwk<Kms.Ed25519PublicJwk>
  service: ResolvedDidCommService
  returnRoute?: boolean
}

export interface OutboundDidCommMessageContextParams {
  agentContext: AgentContext
  inboundMessageContext?: InboundDidCommMessageContext
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  associatedRecord?: BaseRecord<any, any, any>
  connection?: ConnectionRecord
  serviceParams?: ServiceMessageParams
  outOfBand?: OutOfBandRecord
  sessionId?: string
}

export class OutboundDidCommMessageContext<T extends DidCommMessage = DidCommMessage> {
  public message: T
  public connection?: ConnectionRecord
  public serviceParams?: ServiceMessageParams
  public outOfBand?: OutOfBandRecord
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  public associatedRecord?: BaseRecord<any, any, any>
  public sessionId?: string
  public inboundMessageContext?: InboundDidCommMessageContext
  public readonly agentContext: AgentContext

  public constructor(message: T, context: OutboundDidCommMessageContextParams) {
    this.message = message
    this.connection = context.connection
    this.sessionId = context.sessionId
    this.outOfBand = context.outOfBand
    this.serviceParams = context.serviceParams
    this.associatedRecord = context.associatedRecord
    this.inboundMessageContext = context.inboundMessageContext
    this.agentContext = context.agentContext
  }

  /**
   * Assert the outbound message has a ready connection associated with it.
   *
   * @throws {CredoError} if there is no connection or the connection is not ready
   */
  public assertReadyConnection(): ConnectionRecord {
    if (!this.connection) {
      throw new CredoError(`No connection associated with outgoing message ${this.message.type}`)
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
      associatedRecord: this.associatedRecord,
      sessionId: this.sessionId,
      serviceParams: this.serviceParams,
      agentContext: this.agentContext.toJSON(),
      connection: this.connection,
    }
  }
}
