import { AckDidCommMessage, IsValidMessageType, parseMessageType } from '@credo-ts/didcomm'

export class V1PresentationAckMessage extends AckDidCommMessage {
  public readonly allowDidSovPrefix = true

  @IsValidMessageType(V1PresentationAckMessage.type)
  public readonly type = V1PresentationAckMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/present-proof/1.0/ack')
}
