import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { CredentialRecord } from '../repository/CredentialRecord'
import type { CredentialService } from '../services'

import { createOutboundMessage } from '../../../agent/helpers'
import { IssueCredentialMessage } from '../messages'

import { AutoResponseHandler } from './AutoResponseHandler'

export class IssueCredentialHandler implements Handler {
  private credentialService: CredentialService
  private agentConfig: AgentConfig
  public supportedMessages = [IssueCredentialMessage]

  public constructor(credentialService: CredentialService, agentConfig: AgentConfig) {
    this.credentialService = credentialService
    this.agentConfig = agentConfig
  }

  public async handle(messageContext: HandlerInboundMessage<IssueCredentialHandler>) {
    const credentialRecord = await this.credentialService.processCredential(messageContext)
    if (
      await AutoResponseHandler.shouldAutoRespondToIssue(
        credentialRecord,
        this.agentConfig.autoAcceptCredentials,
        this.agentConfig.logger
      )
    ) {
      return await this.sendAck(credentialRecord, messageContext)
    }
  }

  /**
   * Sends an acknowledgement message to the other agent
   *
   * @param credentialRecord The credentialRecord that contains the message(s) to respond to
   * @param messageContext The context that is needed to respond on
   * @returns a message that will be send to the other agent
   */
  private async sendAck(
    credentialRecord: CredentialRecord,
    messageContext: HandlerInboundMessage<IssueCredentialHandler>
  ) {
    this.agentConfig.logger.info(
      `Automatically sending acknowledgement with autoAccept on ${this.agentConfig.autoAcceptCredentials}`
    )

    if (!messageContext.connection) {
      this.agentConfig.logger.error(`No connection on the messageContext`)
      return
    }
    const { message } = await this.credentialService.createAck(credentialRecord)

    return createOutboundMessage(messageContext.connection, message)
  }
}
