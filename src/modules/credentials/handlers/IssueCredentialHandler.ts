import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { CredentialRecord } from '../repository'
import type { CredentialService } from '../services'

import { createOutboundMessage } from '../../../agent/helpers'
import { AutoAcceptCredentialAndProof } from '../../../types'
import { CredentialUtils } from '../CredentialUtils'
import { IssueCredentialMessage } from '../messages'

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

    const autoAccept = CredentialUtils.composeAutoAccept(
      credentialRecord.autoAcceptCredential,
      this.agentConfig.autoAcceptCredentials
    )

    // Always accept any credential no matter what
    if (autoAccept === AutoAcceptCredentialAndProof.always) {
      return await this.nextStep(credentialRecord, messageContext)
    } else if (autoAccept === AutoAcceptCredentialAndProof.attributesNotChanged) {
      if (credentialRecord.credentialAttributes && credentialRecord.credentialMessage) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const credentialMessageValues = credentialRecord.credentialMessage.indyCredential!.values
          const credentialRecordValues = CredentialUtils.convertAttributesToValues(
            credentialRecord.credentialAttributes
          )
          CredentialUtils.assertValuesMatch(credentialMessageValues, credentialRecordValues)
          return await this.nextStep(credentialRecord, messageContext)
          // eslint-disable-next-line no-empty
        } catch {}
      }
    }
  }

  private async nextStep(
    credentialRecord: CredentialRecord,
    messageContext: HandlerInboundMessage<IssueCredentialHandler>
  ) {
    const { message } = await this.credentialService.createAck(credentialRecord)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return createOutboundMessage(messageContext.connection!, message)
  }
}
