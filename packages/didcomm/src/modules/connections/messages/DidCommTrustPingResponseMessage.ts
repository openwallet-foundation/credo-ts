import { IsOptional, IsString } from 'class-validator'
import { DidCommMessage } from '../../../DidCommMessage'
import type { TimingDecorator } from '../../../decorators/timing/TimingDecorator'
import { IsValidMessageType, parseMessageType } from '../../../util/messageType'

export interface DidCommTrustPingResponseMessageOptions {
  comment?: string
  id?: string
  threadId: string
  timing?: Pick<TimingDecorator, 'inTime' | 'outTime'>
}

/**
 * Message to respond to a trust ping message
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0048-trust-ping/README.md#messages
 */
export class DidCommTrustPingResponseMessage extends DidCommMessage {
  public readonly allowDidSovPrefix = true

  /**
   * Create new DidCommTrustPingResponseMessage instance.
   * responseRequested will be true if not passed
   * @param options
   */
  public constructor(options: DidCommTrustPingResponseMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.comment = options.comment

      this.setThread({
        threadId: options.threadId,
      })

      if (options.timing) {
        this.setTiming({
          inTime: options.timing.inTime,
          outTime: options.timing.outTime,
        })
      }
    }
  }

  @IsValidMessageType(DidCommTrustPingResponseMessage.type)
  public readonly type = DidCommTrustPingResponseMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/trust_ping/1.0/ping_response')

  @IsString()
  @IsOptional()
  public comment?: string
}
