import { utils } from '@credo-ts/core'
import { parseMessageType } from '../../../../util/messageType'
import type { DidCommV2Attachment, DidCommV2PlaintextMessage } from '../../../../v2/types'

export const FORWARD_MESSAGE_TYPE_V2 = parseMessageType('https://didcomm.org/routing/2.0/forward')

export interface ForwardMessageV2Options {
  id?: string
  /** DIDs of the mediator(s) receiving this forward (e.g. first hop) */
  to: string[]
  /** Next hop: DID or key identifier for the party to receive the attached payload */
  next: string
  /** Payload(s) to forward; encrypted for the `next` recipient */
  attachments: DidCommV2Attachment[]
  expiresTime?: number
}

/**
 * Build a DIDComm v2 Forward plaintext message (routing/2.0/forward).
 * Used when wrapping messages for mediators; outer envelope is anoncrypt.
 *
 * @see https://identity.foundation/didcomm-messaging/spec/v2.1/#routing-protocol
 */
export function createForwardMessageV2(options: ForwardMessageV2Options): DidCommV2PlaintextMessage {
  const { id, to, next, attachments, expiresTime } = options
  const msg: DidCommV2PlaintextMessage = {
    id: id ?? utils.uuid(),
    type: FORWARD_MESSAGE_TYPE_V2.messageTypeUri,
    to,
    body: { next },
    attachments,
  }
  if (expiresTime !== undefined) msg.expires_time = expiresTime
  return msg
}
