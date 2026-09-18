import { Expose } from 'class-transformer'
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator'

import { DidCommMessage } from '../../../../../DidCommMessage'
import type { DidCommVersion } from '../../../../../util/didcommVersion'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'

export interface DidCommStatusV4MessageOptions {
  id?: string
  recipientDid?: string
  threadId: string
  messageCount: number
  newestReceivedTime?: number
  oldestReceivedTime?: number
  totalBytes?: number
  liveDelivery?: boolean
}

export class DidCommStatusV4Message extends DidCommMessage {
  public readonly allowQueueTransport = false
  public readonly supportedDidCommVersions: DidCommVersion[] = ['v2']

  public constructor(options: DidCommStatusV4MessageOptions) {
    super()
    if (options) {
      this.id = options.id ?? this.generateId()
      this.recipientDid = options.recipientDid
      this.messageCount = options.messageCount
      this.newestReceivedTime = options.newestReceivedTime
      this.oldestReceivedTime = options.oldestReceivedTime
      this.totalBytes = options.totalBytes
      this.liveDelivery = options.liveDelivery
      this.setThread({
        threadId: options.threadId,
      })
    }
  }

  @IsValidMessageType(DidCommStatusV4Message.type)
  public readonly type = DidCommStatusV4Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/message-pickup/4.0/status')

  @IsString()
  @IsOptional()
  @Expose({ name: 'recipient_did' })
  public recipientDid?: string

  @IsInt()
  @Expose({ name: 'message_count' })
  public messageCount!: number

  @IsInt()
  @IsOptional()
  @Expose({ name: 'newest_received_time' })
  public newestReceivedTime?: number

  @IsInt()
  @IsOptional()
  @Expose({ name: 'oldest_received_time' })
  public oldestReceivedTime?: number

  @IsOptional()
  @IsInt()
  @Expose({ name: 'total_bytes' })
  public totalBytes?: number

  @IsOptional()
  @IsBoolean()
  @Expose({ name: 'live_delivery' })
  public liveDelivery?: boolean
}
