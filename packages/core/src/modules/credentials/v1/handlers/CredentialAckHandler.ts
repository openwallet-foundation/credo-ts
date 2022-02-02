import type { V1LegacyCredentialService } from '../..'
import type { Handler, HandlerInboundMessage } from '../../../../agent/Handler'

import { CredentialAckMessage } from '../messages'

export class CredentialAckHandler implements Handler {
  private credentialService: V1LegacyCredentialService
  public supportedMessages = [CredentialAckMessage]

  public constructor(credentialService: V1LegacyCredentialService) {
    this.credentialService = credentialService
  }

  public async handle(messageContext: HandlerInboundMessage<CredentialAckHandler>) {
    await this.credentialService.processAck(messageContext)
  }
}
