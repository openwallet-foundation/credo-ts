import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import type { DidCommOutOfBandService } from '../../oob/DidCommOutOfBandService'
import type { DidExchangeProtocol } from '../DidExchangeProtocol'

import { CredoError, tryParseDid } from '@credo-ts/core'
import { DidExchangeCompleteMessage } from '../messages'
import { DidCommHandshakeProtocol } from '../models'

export class DidExchangeCompleteHandler implements DidCommMessageHandler {
  private didExchangeProtocol: DidExchangeProtocol
  private outOfBandService: DidCommOutOfBandService
  public supportedMessages = [DidExchangeCompleteMessage]

  public constructor(didExchangeProtocol: DidExchangeProtocol, outOfBandService: DidCommOutOfBandService) {
    this.didExchangeProtocol = didExchangeProtocol
    this.outOfBandService = outOfBandService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidExchangeCompleteHandler>) {
    const { connection: connectionRecord } = messageContext

    if (!connectionRecord) {
      throw new CredoError('Connection is missing in message context')
    }

    const { protocol } = connectionRecord
    if (protocol !== DidCommHandshakeProtocol.DidExchange) {
      throw new CredoError(
        `Connection record protocol is ${protocol} but handler supports only ${DidCommHandshakeProtocol.DidExchange}.`
      )
    }

    const { message } = messageContext
    const parentThreadId = message.thread?.parentThreadId
    if (!parentThreadId) {
      throw new CredoError('Message does not contain pthid attribute')
    }
    const outOfBandRecord = await this.outOfBandService.findByCreatedInvitationId(
      messageContext.agentContext,
      parentThreadId,
      tryParseDid(parentThreadId) ? message.threadId : undefined
    )

    if (!outOfBandRecord) {
      throw new CredoError(`OutOfBand record for message ID ${message.thread?.parentThreadId} not found!`)
    }

    await this.didExchangeProtocol.processComplete(messageContext, outOfBandRecord)

    return undefined
  }
}
