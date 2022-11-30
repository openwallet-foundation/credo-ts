import type { DIDCommV2MessageParams } from '../../../../../../agent/didcomm'

import { Expose, Type } from 'class-transformer'
import { IsBoolean, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../../../../agent/didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../../utils/messageType'

export type StatusResponseMessageParams = {
  body: StatusResponseBodyParams
} & DIDCommV2MessageParams

export type StatusResponseBodyParams = {
  messageCount: number
  recipientKey?: string
  longestWaitedSeconds?: number
  newestReceivedTime?: number
  oldestReceivedTime?: number
  totalBytes?: number
  liveDelivery?: boolean
}

class StatusResponse {
  @IsNumber()
  @Expose({ name: 'message_count' })
  public messageCount: number

  @IsNumber()
  @IsOptional()
  @Expose({ name: 'longest_waited_seconds' })
  public longestWaitedSeconds?: number

  @IsNumber()
  @IsOptional()
  @Expose({ name: 'newest_received_time' })
  public newestReceivedTime?: number

  @IsNumber()
  @IsOptional()
  @Expose({ name: 'oldest_received_time' })
  public oldestReceivedTime?: number

  @IsString()
  @IsOptional()
  @Expose({ name: 'recipient_key' })
  public recipientKey?: string

  @IsNumber()
  @IsOptional()
  @Expose({ name: 'total_bytes' })
  public totalBytes?: number

  @IsBoolean()
  @IsOptional()
  @Expose({ name: 'live_delivery' })
  public liveDelivery?: boolean

  public constructor(params: StatusResponseBodyParams) {
    this.messageCount = params.messageCount
    this.longestWaitedSeconds = params.longestWaitedSeconds
    this.newestReceivedTime = params.newestReceivedTime
    this.oldestReceivedTime = params.oldestReceivedTime
    this.recipientKey = params.recipientKey
    this.totalBytes = params.totalBytes
    this.liveDelivery = params.liveDelivery
  }
}

export class StatusResponseMessage extends DIDCommV2Message {
  @IsObject()
  @ValidateNested()
  @Type(() => StatusResponse)
  public body!: StatusResponse

  @IsValidMessageType(StatusResponseMessage.type)
  public readonly type = StatusResponseMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/messagepickup/3.0/status')

  public constructor(params?: StatusResponseMessageParams) {
    super(params)
    if (params) {
      this.body = params.body
    }
  }
}
