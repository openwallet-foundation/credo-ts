import type { BaseName, HashName } from '@credo-ts/core'
import { CredoError, HashlinkEncoder, TypedArrayEncoder } from '@credo-ts/core'
import type { DidCommAttachment } from '../decorators/attachment/DidCommAttachment'

/**
 * Encodes an attachment based on the `data` property
 *
 * @param attachment The attachment that needs to be encoded
 * @param hashAlgorithm The hashing algorithm that is going to be used
 * @param baseName The base encoding name that is going to be used
 * @returns A hashlink based on the attachment data
 */
export function encodeAttachment(
  attachment: DidCommAttachment,
  hashAlgorithm: HashName = 'sha-256',
  baseName: BaseName = 'base58btc'
) {
  if (attachment.data.sha256) {
    return `hl:${attachment.data.sha256}`
  }
  if (attachment.data.base64) {
    return HashlinkEncoder.encode(TypedArrayEncoder.fromBase64(attachment.data.base64), hashAlgorithm, baseName)
  }
  if (attachment.data.json) {
    throw new CredoError(`Attachment: (${attachment.id}) has json encoded data. This is currently not supported`)
  }
  throw new CredoError(`Attachment: (${attachment.id}) has no data to create a link with`)
}
