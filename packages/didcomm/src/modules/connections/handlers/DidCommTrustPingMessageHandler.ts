import { CredoError } from '@credo-ts/core'
import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import { DidCommTrustPingMessage, DidCommTrustPingV2Message } from '../messages'
import { DidCommDidExchangeState } from '../models'
import type { DidCommConnectionService, DidCommTrustPingService } from '../services'

export class DidCommTrustPingMessageHandler implements DidCommMessageHandler {
  private trustPingService: DidCommTrustPingService
  private connectionService: DidCommConnectionService
  public supportedMessages = [DidCommTrustPingMessage, DidCommTrustPingV2Message]

  public constructor(trustPingService: DidCommTrustPingService, connectionService: DidCommConnectionService) {
    this.trustPingService = trustPingService
    this.connectionService = connectionService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommTrustPingMessageHandler>) {
    const { connection, recipientKey } = messageContext
    if (!connection) {
      throw new CredoError(`Connection for verkey ${recipientKey?.fingerprint} not found!`)
    }

    this.trustPingService.assertSupportedDidCommVersion(messageContext, connection)

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
