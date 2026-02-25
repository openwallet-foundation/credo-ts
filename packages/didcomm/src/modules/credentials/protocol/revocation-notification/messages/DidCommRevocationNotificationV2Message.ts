import { Expose } from 'class-transformer'
import { IsOptional, IsString } from 'class-validator'

import { DidCommMessage } from '../../../../../DidCommMessage'
import { AckDecorator } from '../../../../../decorators/ack/AckDecorator'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'

export interface DidCommRevocationNotificationV2MessageOptions {
  revocationFormat: string
  credentialId: string
  id?: string
  comment?: string
  pleaseAck?: AckDecorator
}

export class DidCommRevocationNotificationV2Message extends DidCommMessage {
  public constructor(options: DidCommRevocationNotificationV2MessageOptions) {
    super()
    if (options) {
      this.revocationFormat = options.revocationFormat
      this.credentialId = options.credentialId
      this.id = options.id ?? this.generateId()
      this.comment = options.comment
      this.pleaseAck = options.pleaseAck
    }
  }

  @IsValidMessageType(DidCommRevocationNotificationV2Message.type)
  public readonly type = DidCommRevocationNotificationV2Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/revocation_notification/2.0/revoke')

  @IsString()
  @IsOptional()
  public comment?: string

  @Expose({ name: 'revocation_format' })
  @IsString()
  public revocationFormat!: string

  @Expose({ name: 'credential_id' })
  @IsString()
  public credentialId!: string
}
