import { DidCommAckMessage, IsValidMessageType, parseMessageType } from '@credo-ts/didcomm'

export class DidCommPresentationV1AckMessage extends DidCommAckMessage {
  public readonly allowDidSovPrefix = true

  @IsValidMessageType(DidCommPresentationV1AckMessage.type)
  public readonly type = DidCommPresentationV1AckMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/present-proof/1.0/ack')
}
