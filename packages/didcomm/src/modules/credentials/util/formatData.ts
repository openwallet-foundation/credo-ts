import { JsonEncoder } from '@credo-ts/core'
import { DidCommAttachment, DidCommAttachmentData } from '../../../decorators/attachment/DidCommAttachment'

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
