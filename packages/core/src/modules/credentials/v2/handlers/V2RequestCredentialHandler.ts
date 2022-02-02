/* eslint-disable @typescript-eslint/no-unused-vars */
import type { InboundMessageContext } from '../../../../../src/agent/models/InboundMessageContext'
import type { AgentConfig } from '../../../../agent/AgentConfig'
import type { Handler } from '../../../../agent/Handler'
import type { CredentialResponseCoordinator } from '../../CredentialResponseCoordinator'
import type { AcceptRequestOptions } from '../../interfaces'
import type { CredentialRecord } from '../../repository'
import type { V2CredentialService } from '../V2CredentialService'
import type { CredentialFormatService } from '../formats/CredentialFormatService'

import { createOutboundMessage, createOutboundServiceMessage } from '../../../../agent/helpers'
import { ConsoleLogger, unitTestLogger } from '../../../../logger'
import { CredentialProtocolVersion } from '../../CredentialProtocolVersion'
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
    unitTestLogger('----------------------------- >>>>TEST-DEBUG WE ARE IN THE v2 HANDLER FOR REQUEST CREDENTIAL')
    const credentialRecord = await this.credentialService.processRequest(messageContext)

    const requestMessage: V2RequestCredentialMessage = credentialRecord.requestMessage as V2RequestCredentialMessage

    // 1. Get all formats for this message
    const formatServices: CredentialFormatService[] = this.credentialService.getFormatsFromMessage(
      requestMessage.formats
    )

    // 2. loop through found formats
    let shouldAutoRespond = true
    for (const formatService of formatServices) {
      // 3. Call format.shouldRespondToProposal for each one
      const formatShouldAutoRespond = formatService.shouldAutoRespondToRequest(
        credentialRecord,
        this.agentConfig.autoAcceptCredentials
      )
      shouldAutoRespond = shouldAutoRespond && formatShouldAutoRespond
    }

    unitTestLogger('----------------->>> REQUEST HANDLER shouldAutoRespond = ' + shouldAutoRespond)
    // 4. if all formats are eligibile for auto response then call create offer
    if (shouldAutoRespond) {
      return await this.createCredential(credentialRecord, messageContext)
    }
  }

  private async createCredential(
    record: CredentialRecord,
    messageContext: InboundMessageContext<V2RequestCredentialMessage>
  ) {
    this.agentConfig.logger.info(
      `Automatically sending credential with autoAccept on ${this.agentConfig.autoAcceptCredentials}`
    )
    const options: AcceptRequestOptions = {
      comment: record.requestMessage?.comment,
      autoAcceptCredential: record.autoAcceptCredential,
      protocolVersion: CredentialProtocolVersion.V2_0,
      credentialRecordId: record.id,
    }

    const { message, credentialRecord } = await this.credentialService.createCredential(record, options)
    if (messageContext.connection) {
      unitTestLogger('Sending ISSUE CREDENTIAL message: ' + message)

      return createOutboundMessage(messageContext.connection, message)
    } else if (credentialRecord.requestMessage?.service && credentialRecord.offerMessage?.service) {
      const recipientService = credentialRecord.requestMessage.service
      const ourService = credentialRecord.offerMessage.service

      // Set ~service, update message in record (for later use)
      message.setService(ourService)
      credentialRecord.credentialMessage = message
      await this.credentialService.update(credentialRecord)

      return createOutboundServiceMessage({
        payload: message,
        service: recipientService.toDidCommService(),
        senderKey: ourService.recipientKeys[0],
      })
    }
    this.agentConfig.logger.error(`Could not automatically create credential request`)
  }
}
