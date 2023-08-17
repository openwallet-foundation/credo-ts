import type { ParsedMessageType } from '../../../utils/messageType'
import type { Constructor } from '../../../utils/mixins'

import { Expose, Type } from 'class-transformer'
import { IsArray, IsNumber, IsOptional, IsString, Matches, ValidateNested } from 'class-validator'

import { V2Attachment } from '../../../decorators/attachment'
import { uuid } from '../../../utils/uuid'
import { MessageIdRegExp, MessageTypeRegExp } from '../../validation'

export type DidComV2BaseMessageConstructor = Constructor<DidCommV2BaseMessage>

export type DidCommV2MessageParams = {
  type?: string
  id?: string
  from?: string
  to?: string | string[]
  thid?: string
  parentThreadId?: string
  createdTime?: number
  expiresTime?: number
  fromPrior?: string
  language?: string
  attachments?: Array<V2Attachment>
  body?: unknown
}

export class DidCommV2BaseMessage {
  @Matches(MessageIdRegExp)
  public id!: string

  @Matches(MessageTypeRegExp)
  public readonly type!: string
  public static readonly type: ParsedMessageType

  @Expose({ name: 'typ' })
  public readonly mediaType = DidCommV2BaseMessage.mediaType
  public static readonly mediaType = 'application/didcomm-plain+json'

  @IsString()
  @IsOptional()
  public from?: string

  @IsArray()
  @IsOptional()
  public to?: Array<string>

  @Expose({ name: 'created_time' })
  @IsNumber()
  @IsOptional()
  public createdTime?: number

  @Expose({ name: 'expires_time' })
  @IsNumber()
  @IsOptional()
  public expiresTime?: number

  @IsString()
  @IsOptional()
  public thid?: string

  @Expose({ name: 'pthid' })
  @IsString()
  @IsOptional()
  public parentThreadId?: string

  @Expose({ name: 'from_prior' })
  @IsString()
  @IsOptional()
  public fromPrior?: string

  @Expose({ name: 'lang' })
  @IsString()
  @IsOptional()
  public language?: string

  public body!: unknown

  @IsOptional()
  @Type(() => V2Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  public attachments?: Array<V2Attachment>

  public constructor(options?: DidCommV2MessageParams) {
    if (options) {
      this.id = options.id || this.generateId()
      this.type = options.type || this.type
      this.from = options.from
      this.to = typeof options.to === 'string' ? [options.to] : options.to
      this.thid = options.thid
      this.parentThreadId = options.parentThreadId
      this.createdTime = options.createdTime
      this.expiresTime = options.expiresTime
      this.fromPrior = options.fromPrior
      this.attachments = options.attachments
      this.body = options.body || {}
    }
  }

  public generateId() {
    return uuid()
  }

  public getAttachmentDataAsJson(id?: string) {
    if (!this.attachments || !this.attachments.length) return null
    const attachment = id ? this.attachments?.find((attachment) => attachment.id === id) : this.attachments[0]
    return attachment?.getDataAsJson()
  }
}
