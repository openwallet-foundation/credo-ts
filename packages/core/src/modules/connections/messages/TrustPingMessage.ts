import type { DIDCommV2MessageParams } from '../../../agent/didcomm'
import type { TimingDecorator } from '../../../decorators/timing/TimingDecorator'

import { Expose, Type } from 'class-transformer'
import { Equals, IsString, IsBoolean, IsOptional, IsNotEmpty, IsObject, ValidateNested } from 'class-validator'

import { DIDCommV1Message } from '../../../agent/didcomm/v1/DIDCommV1Message'
import { DIDCommV2Message } from '../../../agent/didcomm/v2/DIDCommV2Message'

export interface TrustPingMessageOptions {
  comment?: string
  id?: string
  responseRequested?: boolean
  timing?: Pick<TimingDecorator, 'outTime' | 'expiresTime' | 'delayMilli'>
}

/**
 * Message to initiate trust ping interaction
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0048-trust-ping/README.md#messages
 */
export class TrustPingMessage extends DIDCommV1Message {
  /**
   * Create new TrustPingMessage instance.
   * responseRequested will be true if not passed
   * @param options
   */
  public constructor(options: TrustPingMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.comment = options.comment
      this.responseRequested = options.responseRequested !== undefined ? options.responseRequested : true

      if (options.timing) {
        this.setTiming({
          outTime: options.timing.outTime,
          expiresTime: options.timing.expiresTime,
          delayMilli: options.timing.delayMilli,
        })
      }
    }
  }

  @Equals(TrustPingMessage.type)
  public readonly type = TrustPingMessage.type
  public static readonly type = 'https://didcomm.org/trust_ping/1.0/ping'

  @IsString()
  @IsOptional()
  public comment?: string

  @IsBoolean()
  @Expose({ name: 'response_requested' })
  public responseRequested = true
}

export type TrustPingMessageV2Options = {
  body: TrustPingBody
} & DIDCommV2MessageParams

class TrustPingBody {
  @IsBoolean()
  @Expose({ name: 'response_requested' })
  public responseRequested = true
}

export class TrustPingMessageV2 extends DIDCommV2Message {
  @IsString()
  @IsNotEmpty()
  public from!: string

  @IsObject()
  @ValidateNested()
  @Type(() => TrustPingBody)
  public body!: TrustPingBody

  @Equals(TrustPingMessageV2.type)
  public readonly type = TrustPingMessageV2.type
  public static readonly type = 'https://didcomm.org/trust-ping/2.0/ping'

  public constructor(options: TrustPingMessageV2Options) {
    super(options)

    if (options) {
      this.body = options.body
    }
  }
}
