import { AgentConfig } from "../../../../agent/AgentConfig"
import { Handler, HandlerInboundMessage } from "../../../../agent/Handler"
import { CredentialResponseCoordinator } from "../../CredentialResponseCoordinator"
import { V2CredentialService } from "../V2CredentialService"
import { V2ProposeCredentialMessage } from '../messages/V2ProposeCredentialMessage'
import { CredentialRecord } from "../.."
import { ConnectionRecord } from "../../../connections"

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
    console.log("----------------------------- >>>>TEST-DEBUG WE ARE IN THE v2 HANDLER FOR PROPOSE CREDENTIAL")
    const credentialRecord = await this.credentialService.processProposal(messageContext)
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

    const { message } = await this.credentialService.createOfferAsResponse(credentialRecord, {
      credentialDefinitionId: credentialRecord.proposalMessage.credentialDefinitionId,
      preview: credentialRecord.proposalMessage.credentialProposal,
    })

    return createOutboundMessage(messageContext.connection, message)
  }
}

function createOutboundMessage(connection: ConnectionRecord, message: any) {
  throw new Error("Function not implemented.")
}
