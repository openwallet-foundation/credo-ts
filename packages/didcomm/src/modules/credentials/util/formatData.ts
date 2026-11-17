import type { AgentContext } from '@credo-ts/core'
import { JsonEncoder } from '@credo-ts/core'
import { DidCommAttachment, DidCommAttachmentData } from '../../../decorators/attachment/DidCommAttachment'
import { DidCommMessageRepository, DidCommMessageRole } from '../../../repository'
import { DidCommOfferCredentialV2Message } from '../protocol/v2/messages/DidCommOfferCredentialV2Message'

/**
 * Returns a {@link DidCommAttachment} for use in credential exchange messages, encoding the data as a
 * base64 attachment.
 *
 * @param data The data to include in the attachment
 * @param id The attachment id from the `formats` component of the message
 */
export function getFormatDataAttachment(data: unknown, id: string): DidCommAttachment {
  return new DidCommAttachment({
    id,
    mimeType: 'application/json',
    data: new DidCommAttachmentData({
      base64: JsonEncoder.toBase64(data),
    }),
  })
}

/**
 * Returns the attachment of the given format in the v2 offer this agent sent for the credential exchange.
 */
export async function findSentOfferAttachment(
  agentContext: AgentContext,
  credentialExchangeRecordId: string,
  format: string
): Promise<DidCommAttachment | undefined> {
  const offerMessage = await agentContext.dependencyManager
    .resolve(DidCommMessageRepository)
    .findAgentMessage(agentContext, {
      associatedRecordId: credentialExchangeRecordId,
      messageClass: DidCommOfferCredentialV2Message,
      role: DidCommMessageRole.Sender,
    })
  const offerFormat = offerMessage?.formats.find((spec) => spec.format === format)
  return offerFormat && offerMessage?.getOfferAttachmentById(offerFormat.attachmentId)
}
