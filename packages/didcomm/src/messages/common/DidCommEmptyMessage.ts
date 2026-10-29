import { Expose } from 'class-transformer'
import { IsOptional, IsString } from 'class-validator'

import { DidCommMessage } from '../../DidCommMessage'
import { IsValidMessageType, parseMessageType } from '../../util/messageType'
import type { DidCommV2PlaintextMessage } from '../../v2/types'

export interface DidCommEmptyMessageOptions {
  id?: string
  fromPrior?: string
  /** Ids of the messages this empty message acknowledges, sent as the `ack` header. */
  ack?: string[]
}

/**
 * @see https://identity.foundation/didcomm-messaging/spec/v2.1/#the-empty-message
 */
export class DidCommEmptyMessage extends DidCommMessage {
  public constructor(options?: DidCommEmptyMessageOptions) {
    super()
    this.id = options?.id ?? this.generateId()
    if (options?.fromPrior !== undefined) this.fromPrior = options.fromPrior
    if (options?.ack !== undefined) this.ack = options.ack
  }

  @IsValidMessageType(DidCommEmptyMessage.type)
  public readonly type: string = DidCommEmptyMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/empty/1.0/empty')

  @Expose({ name: 'from_prior' })
  @IsString()
  @IsOptional()
  public fromPrior?: string

  public toV2Plaintext(): DidCommV2PlaintextMessage {
    const v2: DidCommV2PlaintextMessage = {
      id: this.id,
      type: DidCommEmptyMessage.type.messageTypeUri,
      body: {},
    }
    if (this.fromPrior !== undefined) v2.from_prior = this.fromPrior
    if (this.ack !== undefined && this.ack.length > 0) v2.ack = this.ack
    return v2
  }
}
