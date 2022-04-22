import type { Constructor } from '../../../utils/mixins'
import type { Attachment } from 'didcomm'

import { Expose } from 'class-transformer'
import { IsArray, IsNumber, IsOptional, IsString, Matches, ValidateNested } from 'class-validator'

import { uuid } from '../../../utils/uuid'
import { MessageIdRegExp, MessageTypeRegExp } from '../validation'

export type DIDComV2BaseMessageConstructor = Constructor<DIDCommV2BaseMessage>

export class DIDCommV2BaseMessage {
  @Expose({ name: 'id' })
  @Matches(MessageIdRegExp)
  public id!: string

  @Expose({ name: 'type' })
  @Matches(MessageTypeRegExp)
  public readonly type!: string
  public static readonly type: string

  @Expose({ name: 'typ' })
  public readonly typ = DIDCommV2BaseMessage.type
  public static readonly typ = 'application/didcomm-plain+json'

  @Expose({ name: 'body' })
  @ValidateNested()
  public body!: any

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

  @IsString()
  @IsOptional()
  public attachments?: Array<Attachment>

  public generateId() {
    return uuid()
  }
}
