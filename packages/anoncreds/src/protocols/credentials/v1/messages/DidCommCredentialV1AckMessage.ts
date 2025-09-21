import type { DidCommAckMessageOptions } from '@credo-ts/didcomm'

import { DidCommAckMessage, IsValidMessageType, parseMessageType } from '@credo-ts/didcomm'

export type V1CredentialAckMessageOptions = DidCommAckMessageOptions

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0015-acks/README.md#explicit-acks
 */
export class DidCommCredentialV1AckMessage extends DidCommAckMessage {
  public readonly allowDidSovPrefix = true

  @IsValidMessageType(DidCommCredentialV1AckMessage.type)
  public readonly type = DidCommCredentialV1AckMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/1.0/ack')
}
