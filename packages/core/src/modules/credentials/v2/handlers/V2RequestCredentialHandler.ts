/* eslint-disable @typescript-eslint/no-unused-vars */
import type { AgentConfig } from '../../../../agent/AgentConfig'
import type { Handler } from '../../../../agent/Handler'
import type { CredentialResponseCoordinator } from '../../CredentialResponseCoordinator'
import type { V2CredentialService } from '../V2CredentialService'
import type { InboundMessageContext } from 'packages/core/src/agent/models/InboundMessageContext'

import { createOutboundMessage, createOutboundServiceMessage } from '../../../../agent/helpers'
import { V2RequestCredentialMessage } from '../messages/V2RequestCredentialMessage'

export class V2RequestCredentialHandler implements Handler {
  private credentialService: V2CredentialService
  private agentConfig: AgentConfig
  private credentialAutoResponseCoordinator: CredentialResponseCoordinator
  public supportedMessages = [V2RequestCredentialMessage]

  public constructor(
    credentialService: V2CredentialService,
    agentConfig: AgentConfig,
    responseCoordinator: CredentialResponseCoordinator
  ) {
    this.credentialAutoResponseCoordinator = responseCoordinator
    this.credentialService = credentialService
    this.agentConfig = agentConfig
  }

  public async handle(messageContext: InboundMessageContext<V2RequestCredentialMessage>) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const credentialRecord = await this.credentialService.processRequest(messageContext)

    // MJR-TODO
    // if (this.credentialAutoResponseCoordinator.shouldAutoRespondToRequest(credentialRecord)) {
    //   return await this.createCredential(credentialRecord, messageContext)
    // }
  }

  // MJR-TODO
  // private async createCredential(
  //   record: CredentialRecord,
  //   messageContext: HandlerInboundMessage<RequestCredentialHandler>
  // ) {
  //   this.agentConfig.logger.info(
  //     `Automatically sending credential with autoAccept on ${this.agentConfig.autoAcceptCredentials}`
  //   )

  //   const { message, credentialRecord } = await this.credentialService.createCredential(record)
  //   if (messageContext.connection) {
  //     return createOutboundMessage(messageContext.connection, message)
  //   } else if (credentialRecord.requestMessage?.service && credentialRecord.offerMessage?.service) {
  //     const recipientService = credentialRecord.requestMessage.service
  //     const ourService = credentialRecord.offerMessage.service

  //     // Set ~service, update message in record (for later use)
  //     message.setService(ourService)
  //     credentialRecord.credentialMessage = message
  //     await this.credentialService.update(credentialRecord)

  //     return createOutboundServiceMessage({
  //       payload: message,
  //       service: recipientService.toDidCommService(),
  //       senderKey: ourService.recipientKeys[0],
  //     })
  //   }
  //   this.agentConfig.logger.error(`Could not automatically create credential request`)
  // }
}
