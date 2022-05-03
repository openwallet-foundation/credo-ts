import type { AgentConfig } from '../../../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { DidCommMessageRepository } from '../../../../../storage'
import type { HandlerAutoAcceptOptions } from '../../../formats/models/CredentialFormatServiceOptions'
import type { CredentialExchangeRecord } from '../../../repository/CredentialExchangeRecord'
import type { V2CredentialService } from '../V2CredentialService'

import { createOutboundMessage } from '../../../../../agent/helpers'
import { V2ProposeCredentialMessage } from '../messages/V2ProposeCredentialMessage'

export class V2ProposeCredentialHandler implements Handler {
  private credentialService: V2CredentialService
  private agentConfig: AgentConfig
  private didCommMessageRepository: DidCommMessageRepository

  public supportedMessages = [V2ProposeCredentialMessage]

  public constructor(
    credentialService: V2CredentialService,
    agentConfig: AgentConfig,
    didCommMessageRepository: DidCommMessageRepository
  ) {
    this.credentialService = credentialService
    this.agentConfig = agentConfig
    this.didCommMessageRepository = didCommMessageRepository
  }

  public async handle(messageContext: InboundMessageContext<V2ProposeCredentialMessage>) {
    const credentialRecord = await this.credentialService.processProposal(messageContext)

    const handlerOptions: HandlerAutoAcceptOptions = {
      credentialRecord,
      autoAcceptType: this.agentConfig.autoAcceptCredentials,
    }

    const shouldAutoRespond = await this.credentialService.shouldAutoRespondToProposal(handlerOptions)
    if (shouldAutoRespond) {
      return await this.createOffer(credentialRecord, messageContext)
    }
  }

  private async createOffer(
    credentialRecord: CredentialExchangeRecord,
    messageContext: HandlerInboundMessage<V2ProposeCredentialHandler>
  ) {
    this.agentConfig.logger.info(
      `Automatically sending offer with autoAccept on ${this.agentConfig.autoAcceptCredentials}`
    )

    if (!messageContext.connection) {
      this.agentConfig.logger.error('No connection on the messageContext, aborting auto accept')
      return
    }

    const message = await this.credentialService.createOfferAsResponse(credentialRecord)

    return createOutboundMessage(messageContext.connection, message)
  }
}
