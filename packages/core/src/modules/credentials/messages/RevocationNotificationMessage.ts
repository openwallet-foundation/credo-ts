import type { AckDecorator } from '../../../decorators/ack/AckDecorator'

import { Expose } from 'class-transformer'
import { Equals, IsOptional, IsString } from 'class-validator'

import { AgentMessage } from '../../../agent/AgentMessage'

export interface RevocationNotificationMessageV1Options {
  issueThread: string
  id?: string
  comment?: string
  pleaseAck?: AckDecorator
}

export class RevocationNotificationMessageV1 extends AgentMessage {
  public constructor(options: RevocationNotificationMessageV1Options) {
    super()
    if (options) {
      this.issueThread = options.issueThread
      this.id = options.id ?? this.generateId()
      this.comment = options.comment
      this.pleaseAck = options.pleaseAck
    }
  }

  @Equals(RevocationNotificationMessageV1.type)
  public readonly type = RevocationNotificationMessageV1.type
  public static readonly type = 'https://didcomm.org/revocation_notification/1.0/revoke'

  @IsString()
  @IsOptional()
  public comment?: string

  @Expose({ name: 'thread_id' })
  @IsString()
  public issueThread!: string
}

export interface RevocationNotificationMessageV2Options {
  revocationFormat: string
  credentialId: string
  id?: string
  comment?: string
  pleaseAck?: AckDecorator
}

export class RevocationNotificationMessageV2 extends AgentMessage {
  public constructor(options: RevocationNotificationMessageV2Options) {
    super()
    if (options) {
      this.revocationFormat = options.revocationFormat
      this.credentialId = options.credentialId
      this.id = options.id ?? this.generateId()
      this.comment = options.comment
      this.pleaseAck = options.pleaseAck
    }
  }

  @Equals(RevocationNotificationMessageV2.type)
  public readonly type = RevocationNotificationMessageV2.type
  public static readonly type = 'https://didcomm.org/revocation_notification/2.0/revoke'

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
