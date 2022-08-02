import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { ConnectionService } from '../services/ConnectionService'
import type { TrustPingService } from '../services/TrustPingService'

import { AriesFrameworkError } from '../../../error'
import { TrustPingMessage } from '../messages'
import { DidExchangeState } from '../models'

export class TrustPingMessageHandler implements Handler {
  private trustPingService: TrustPingService
  private connectionService: ConnectionService
  public supportedMessages = [TrustPingMessage]

  public constructor(trustPingService: TrustPingService, connectionService: ConnectionService) {
    this.trustPingService = trustPingService
    this.connectionService = connectionService
  }

  public async handle(messageContext: HandlerInboundMessage<TrustPingMessageHandler>) {
    const { connection, recipientKey } = messageContext
    if (!connection) {
      throw new AriesFrameworkError(`Connection for verkey ${recipientKey?.fingerprint} not found!`)
    }

    // TODO: This is better addressed in a middleware of some kind because
    // any message can transition the state to complete, not just an ack or trust ping
    if (connection.state === DidExchangeState.ResponseSent) {
      await this.connectionService.updateState(messageContext.agentContext, connection, DidExchangeState.Completed)
    }

    return this.trustPingService.processPing(messageContext, connection)
  }
}
