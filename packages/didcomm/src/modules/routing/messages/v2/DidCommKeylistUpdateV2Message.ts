import { Expose, Type } from 'class-transformer'
import { IsArray, IsEnum, IsInstance, IsString, ValidateNested } from 'class-validator'

import { ReturnRouteTypes } from '../../../../decorators/transport/TransportDecorator'
import { DidCommMessage } from '../../../../DidCommMessage'
import { IsValidMessageType, parseMessageType } from '../../../../util/messageType'
import type { DidCommVersion } from '../../../../util/didcommVersion'

export enum KeylistUpdateActionV2 {
  add = 'add',
  remove = 'remove',
}

export interface KeylistUpdateItemV2 {
  recipientDid: string
  action: KeylistUpdateActionV2
}

export class KeylistUpdateItem {
  public constructor(options: KeylistUpdateItemV2) {
    if (options) {
      this.recipientDid = options.recipientDid
      this.action = options.action
    }
  }

  @IsString()
  @Expose({ name: 'recipient_did' })
  public recipientDid!: string

  @IsEnum(KeylistUpdateActionV2)
  public action!: KeylistUpdateActionV2
}

export interface DidCommKeylistUpdateV2MessageOptions {
  id?: string
  updates: KeylistUpdateItemV2[]
}

/**
 * Keylist Update 2.0 - notify mediator of recipient_dids in use.
 *
 * @see https://didcomm.org/coordinate-mediation/2.0/
 */
export class DidCommKeylistUpdateV2Message extends DidCommMessage {
  public readonly allowQueueTransport = false
  public readonly supportedDidCommVersions: DidCommVersion[] = ['v2']

  public constructor(options: DidCommKeylistUpdateV2MessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.updates = options.updates.map((u) => new KeylistUpdateItem(u))
    }
    this.setReturnRouting(ReturnRouteTypes.all)
  }

  @IsValidMessageType(DidCommKeylistUpdateV2Message.type)
  public readonly type = DidCommKeylistUpdateV2Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/coordinate-mediation/2.0/keylist-update')

  @Type(() => KeylistUpdateItem)
  @IsArray()
  @ValidateNested()
  @IsInstance(KeylistUpdateItem, { each: true })
  public updates!: KeylistUpdateItem[]
}
