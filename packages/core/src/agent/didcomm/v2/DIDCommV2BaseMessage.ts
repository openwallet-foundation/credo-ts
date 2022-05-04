import type { Attachment } from 'didcomm-node'

import { Expose } from 'class-transformer'
import { IsArray, IsNumber, IsOptional, IsString, Matches } from 'class-validator'

import { uuid } from '../../../utils/uuid'
import { MessageIdRegExp, MessageTypeRegExp } from '../validation'

export type DIDCommV2MessageParams = {
  id?: string
  from?: string
  to?: string
  thid?: string
  pthid?: string
  created_time?: number
  expires_time?: number
  from_prior?: string
  attachments?: Array<Attachment>
  body?: any
}

export class DIDCommV2BaseMessage {
  @Expose({ name: 'id' })
  @Matches(MessageIdRegExp)
  public id!: string

  @Expose({ name: 'type' })
  @Matches(MessageTypeRegExp)
  public readonly type!: string
  public static readonly type: string

  @Expose({ name: 'typ' })
  public readonly typ = DIDCommV2BaseMessage.typ
  public static readonly typ = 'application/didcomm-plain+json'

  @Expose({ name: 'from' })
  @IsString()
  @IsOptional()
  public from?: string

  @Expose({ name: 'to' })
  @IsArray()
  @IsOptional()
  public to?: Array<string>

  @IsNumber()
  @IsOptional()
  public created_time?: number

  @IsNumber()
  @IsOptional()
  public expires_time?: number

  @IsString()
  @IsOptional()
  public thid?: string

  @IsString()
  @IsOptional()
  public pthid?: string

  @IsString()
  @IsOptional()
  public from_prior?: string

  @IsOptional()
  public body?: any

  @IsOptional()
  public attachments?: Array<Attachment>

  public constructor(options?: DIDCommV2MessageParams) {
    if (options) {
      this.id = options.id || this.generateId()
      this.from = options.from
      this.to = options.to ? [options.to] : undefined
      this.thid = options.thid
      this.pthid = options.pthid
      this.created_time = options.created_time
      this.expires_time = options.expires_time
      this.from_prior = options.from_prior
      this.attachments = options.attachments
      this.body = options.body
    }
  }

  public generateId() {
    return uuid()
  }
}
