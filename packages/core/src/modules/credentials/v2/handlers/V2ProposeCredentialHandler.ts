import type { CredentialRecord } from '../..'
import type { AgentConfig } from '../../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../../agent/Handler'
import type { CredentialResponseCoordinator } from '../../CredentialResponseCoordinator'
import type { AcceptProposalOptions } from '../../interfaces'
import type { V2CredentialService } from '../V2CredentialService'
import type { InboundMessageContext } from 'packages/core/src/agent/models/InboundMessageContext'

import { createOutboundMessage } from '../../../../../src/agent/helpers'
import { unitTestLogger } from '../../../../logger'
import { V2ProposeCredentialMessage } from '../messages/V2ProposeCredentialMessage'

export class V2ProposeCredentialHandler implements Handler {
  private credentialService: V2CredentialService
  private agentConfig: AgentConfig
  private credentialAutoResponseCoordinator: CredentialResponseCoordinator
  public supportedMessages = [V2ProposeCredentialMessage]

  public constructor(
    credentialService: V2CredentialService,
    agentConfig: AgentConfig,
    responseCoordinator: CredentialResponseCoordinator
  ) {
    this.credentialAutoResponseCoordinator = responseCoordinator
    this.credentialService = credentialService
    this.agentConfig = agentConfig
  }

  public async handle(messageContext: InboundMessageContext<V2ProposeCredentialMessage>) {
    unitTestLogger('----------------------------- >>>>TEST-DEBUG WE ARE IN THE v2 HANDLER FOR PROPOSE CREDENTIAL')
    const credentialRecord = await this.credentialService.processProposal(messageContext)

    // MJR-TODO there is some indy specific stuff in the credentialAutoResponseCoordinator
    // this needs looking at
    if (this.credentialAutoResponseCoordinator.shouldAutoRespondToProposal(credentialRecord)) {
      return await this.createOffer(credentialRecord, messageContext)
    }
  }

  private async createOffer(
    credentialRecord: CredentialRecord,
    messageContext: HandlerInboundMessage<V2ProposeCredentialHandler>
  ) {
    this.agentConfig.logger.info(
      `Automatically sending offer with autoAccept on ${this.agentConfig.autoAcceptCredentials}`
    )

    if (!messageContext.connection) {
      this.agentConfig.logger.error('No connection on the messageContext, aborting auto accept')
      return
    }

    if (!credentialRecord.proposalMessage?.credentialProposal) {
      this.agentConfig.logger.error(
        `Credential record with id ${credentialRecord.id} is missing required credential proposal`
      )
      return
    }

    const options: AcceptProposalOptions = this.credentialService.createAcceptProposalOptions(credentialRecord)
    const message = await this.credentialService.createOfferAsResponse(credentialRecord, options)

    return createOutboundMessage(messageContext.connection, message)
  }
}
