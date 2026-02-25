import type { AgentContext, BaseRecord, Kms, ResolvedDidCommService } from '@credo-ts/core'
import { CredoError } from '@credo-ts/core'
import type { DidCommMessage } from '../DidCommMessage'
import type { DidCommConnectionRecord } from '../modules/connections/repository'
import type { DidCommOutOfBandRecord } from '../modules/oob'
import type { DidCommInboundMessageContext } from './DidCommInboundMessageContext'

export interface ServiceMessageParams {
  senderKey: Kms.PublicJwk<Kms.Ed25519PublicJwk>
  service: ResolvedDidCommService
  returnRoute?: boolean
}

export interface DidCommOutboundMessageContextParams {
  agentContext: AgentContext
  inboundMessageContext?: DidCommInboundMessageContext
  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  associatedRecord?: BaseRecord<any, any, any>
  connection?: DidCommConnectionRecord
  serviceParams?: ServiceMessageParams
  outOfBand?: DidCommOutOfBandRecord
  sessionId?: string
}

export class DidCommOutboundMessageContext<T extends DidCommMessage = DidCommMessage> {
  public message: T
  public connection?: DidCommConnectionRecord
  public serviceParams?: ServiceMessageParams
  public outOfBand?: DidCommOutOfBandRecord
  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  public associatedRecord?: BaseRecord<any, any, any>
  public sessionId?: string
  public inboundMessageContext?: DidCommInboundMessageContext
  public readonly agentContext: AgentContext

  public constructor(message: T, context: DidCommOutboundMessageContextParams) {
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
  public assertReadyConnection(): DidCommConnectionRecord {
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
