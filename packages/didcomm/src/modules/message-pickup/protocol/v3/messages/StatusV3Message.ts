import { Expose, Transform } from 'class-transformer'
import { IsBoolean, IsDate, IsInt, IsOptional, IsString } from 'class-validator'

import { DidCommMessage } from '../../../../../DidCommMessage'
import { ReturnRouteTypes } from '../../../../../decorators/transport/TransportDecorator'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'
import { DateParser } from '../../../../../util/transformers'

export interface StatusV3MessageOptions {
  id?: string
  recipientDid?: string
  threadId: string
  messageCount: number
  longestWaitedSeconds?: number
  newestReceivedTime?: Date
  oldestReceivedTime?: Date
  totalBytes?: number
  liveDelivery?: boolean
}

export class StatusV3Message extends DidCommMessage {
  public readonly allowQueueTransport = false
  public readonly supportedDidCommVersions: ('v1' | 'v2')[] = ['v2']

  public constructor(options: StatusV3MessageOptions) {
    super()
    if (options) {
      this.id = options.id ?? this.generateId()
      this.recipientDid = options.recipientDid
      this.messageCount = options.messageCount
      this.longestWaitedSeconds = options.longestWaitedSeconds
      this.newestReceivedTime = options.newestReceivedTime
      this.oldestReceivedTime = options.oldestReceivedTime
      this.totalBytes = options.totalBytes
      this.liveDelivery = options.liveDelivery
      this.setThread({
        threadId: options.threadId,
      })
    }
    this.setReturnRouting(ReturnRouteTypes.all)
  }

  @IsValidMessageType(StatusV3Message.type)
  public readonly type = StatusV3Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/messagepickup/3.0/status')

  @IsString()
  @IsOptional()
  @Expose({ name: 'recipient_did' })
  public recipientDid?: string

  @IsInt()
  @Expose({ name: 'message_count' })
  public messageCount!: number

  @IsInt()
  @IsOptional()
  @Expose({ name: 'longest_waited_seconds' })
  public longestWaitedSeconds?: number

  @Expose({ name: 'newest_received_time' })
  @Transform(({ value }) => DateParser(value))
  @IsDate()
  @IsOptional()
  public newestReceivedTime?: Date

  @IsOptional()
  @Transform(({ value }) => DateParser(value))
  @IsDate()
  @Expose({ name: 'oldest_received_time' })
  public oldestReceivedTime?: Date

  @IsOptional()
  @IsInt()
  @Expose({ name: 'total_bytes' })
  public totalBytes?: number

  @IsOptional()
  @IsBoolean()
  @Expose({ name: 'live_delivery' })
  public liveDelivery?: boolean
}
