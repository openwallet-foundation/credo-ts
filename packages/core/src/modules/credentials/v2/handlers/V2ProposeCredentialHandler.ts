import type { CredentialRecord } from '../..'
import type { AgentConfig } from '../../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../../agent/Handler'
import type { CredentialResponseCoordinator } from '../../CredentialResponseCoordinator'
import type { V2CredentialService } from '../V2CredentialService'
import type { CredentialFormatService } from '../formats/CredentialFormatService'
import type { AcceptProposalOptions } from '../interfaces'

import { createOutboundMessage } from '../../../../../src/agent/helpers'
import { unitTestLogger } from '../../../../logger'
import { CredentialRecordType } from '../CredentialExchangeRecord'
import { INDY_ATTACH_ID } from '../formats/V2CredentialFormat'
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

  public async handle(messageContext: HandlerInboundMessage<V2ProposeCredentialHandler>) {
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

    if (!credentialRecord.proposalMessage.credentialDefinitionId) {
      this.agentConfig.logger.error('Missing required credential definition id')
      return
    }

    const msg: V2ProposeCredentialMessage = credentialRecord.proposalMessage as V2ProposeCredentialMessage
    const id = msg.filtersAttach[0].id
    const type: CredentialRecordType = id == INDY_ATTACH_ID ? CredentialRecordType.INDY : CredentialRecordType.W3C
    const formatService: CredentialFormatService = this.credentialService.getFormatService(type)

    const options: AcceptProposalOptions = formatService.createAcceptProposalOptions(credentialRecord)
    const message = await this.credentialService.createOfferAsResponse(credentialRecord, options)

    return createOutboundMessage(messageContext.connection, message)
  }
}
