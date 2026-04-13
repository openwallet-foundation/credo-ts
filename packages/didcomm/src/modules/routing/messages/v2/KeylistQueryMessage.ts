import { Expose, Type } from 'class-transformer'
import { IsInt, IsOptional, ValidateNested } from 'class-validator'

import { ReturnRouteTypes } from '../../../../decorators/transport/TransportDecorator'
import { DidCommMessage } from '../../../../DidCommMessage'
import { IsValidMessageType, parseMessageType } from '../../../../util/messageType'
import type { DidCommVersion } from '../../../../util/didcommVersion'

export interface PaginateOptions {
  limit: number
  offset: number
}

export class Paginate {
  public constructor(options: PaginateOptions) {
    if (options) {
      this.limit = options.limit
      this.offset = options.offset
    }
  }

  @IsInt()
  public limit!: number

  @IsInt()
  public offset!: number
}

export interface KeylistQueryMessageOptions {
  id?: string
  paginate?: PaginateOptions
}

/**
 * Keylist Query 2.0 - query mediator for registered keys (recipient_dids).
 *
 * @see https://didcomm.org/coordinate-mediation/2.0/
 */
export class KeylistQueryMessage extends DidCommMessage {
  public readonly allowQueueTransport = false
  public readonly supportedDidCommVersions: DidCommVersion[] = ['v2']

  public constructor(options: KeylistQueryMessageOptions = {}) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      if (options.paginate) {
        this.paginate = new Paginate(options.paginate)
      }
    }
    this.setReturnRouting(ReturnRouteTypes.all)
  }

  @IsValidMessageType(KeylistQueryMessage.type)
  public readonly type = KeylistQueryMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/coordinate-mediation/2.0/keylist-query')

  @IsOptional()
  @Type(() => Paginate)
  @ValidateNested()
  public paginate?: Paginate
}
