import { Expose, Type } from 'class-transformer'
import { IsArray, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator'

import { DidCommMessage } from '../../../../DidCommMessage'
import { IsValidMessageType, parseMessageType } from '../../../../util/messageType'

export interface KeylistKeyItemV2 {
  recipientDid: string
}

export class KeylistKeyItem {
  public constructor(options: KeylistKeyItemV2) {
    if (options) {
      this.recipientDid = options.recipientDid
    }
  }

  @IsString()
  @Expose({ name: 'recipient_did' })
  public recipientDid!: string
}

export interface KeylistPaginationV2 {
  count: number
  offset: number
  remaining: number
}

export class KeylistPagination {
  public constructor(options: KeylistPaginationV2) {
    if (options) {
      this.count = options.count
      this.offset = options.offset
      this.remaining = options.remaining
    }
  }

  @IsInt()
  public count!: number

  @IsInt()
  public offset!: number

  @IsInt()
  public remaining!: number
}

export interface KeylistMessageOptions {
  id?: string
  keys: KeylistKeyItemV2[]
  pagination?: KeylistPaginationV2
  threadId?: string
}

/**
 * Keylist 2.0 - response to keylist query with registered recipient_dids.
 *
 * @see https://didcomm.org/coordinate-mediation/2.0/
 */
export class KeylistMessage extends DidCommMessage {
  public readonly allowQueueTransport = false
  public readonly supportedDidCommVersions: ('v1' | 'v2')[] = ['v2']

  public constructor(options: KeylistMessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.keys = options.keys.map((k) => new KeylistKeyItem(k))
      if (options.pagination) {
        this.pagination = new KeylistPagination(options.pagination)
      }
      if (options.threadId) {
        this.setThread({ threadId: options.threadId })
      }
    }
  }

  @IsValidMessageType(KeylistMessage.type)
  public readonly type = KeylistMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/coordinate-mediation/2.0/keylist')

  @Type(() => KeylistKeyItem)
  @IsArray()
  @ValidateNested()
  public keys!: KeylistKeyItem[]

  @IsOptional()
  @Type(() => KeylistPagination)
  @ValidateNested()
  public pagination?: KeylistPagination
}
