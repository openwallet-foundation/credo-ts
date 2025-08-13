import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import type { DidCommConnectionService, DidCommTrustPingService } from '../services'

import { CredoError } from '@credo-ts/core'

import { TrustPingMessage } from '../messages'
import { DidCommDidExchangeState } from '../models'

export class TrustPingMessageHandler implements DidCommMessageHandler {
  private trustPingService: DidCommTrustPingService
  private connectionService: DidCommConnectionService
  public supportedMessages = [TrustPingMessage]

  public constructor(trustPingService: DidCommTrustPingService, connectionService: DidCommConnectionService) {
    this.trustPingService = trustPingService
    this.connectionService = connectionService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<TrustPingMessageHandler>) {
    const { connection, recipientKey } = messageContext
    if (!connection) {
      throw new CredoError(`Connection for verkey ${recipientKey?.fingerprint} not found!`)
    }

    // TODO: This is better addressed in a middleware of some kind because
    // any message can transition the state to complete, not just an ack or trust ping
    if (connection.state === DidCommDidExchangeState.ResponseSent) {
      await this.connectionService.updateState(
        messageContext.agentContext,
        connection,
        DidCommDidExchangeState.Completed
      )
    }

    return this.trustPingService.processPing(messageContext, connection)
  }
}
