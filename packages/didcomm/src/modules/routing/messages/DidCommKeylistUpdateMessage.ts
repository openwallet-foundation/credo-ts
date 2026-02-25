import { Expose, Type } from 'class-transformer'
import { IsArray, IsEnum, IsInstance, IsString, ValidateNested } from 'class-validator'

import { DidCommMessage } from '../../../DidCommMessage'
import { IsValidMessageType, parseMessageType } from '../../../util/messageType'

export enum DidCommKeylistUpdateAction {
  add = 'add',
  remove = 'remove',
}

export interface DidCommKeylistUpdateOptions {
  recipientKey: string
  action: DidCommKeylistUpdateAction
}

export class DidCommKeylistUpdate {
  public constructor(options: DidCommKeylistUpdateOptions) {
    if (options) {
      this.recipientKey = options.recipientKey
      this.action = options.action
    }
  }

  @IsString()
  @Expose({ name: 'recipient_key' })
  public recipientKey!: string

  @IsEnum(DidCommKeylistUpdateAction)
  public action!: DidCommKeylistUpdateAction
}

export interface DidCommKeylistUpdateMessageOptions {
  id?: string
  updates: DidCommKeylistUpdate[]
}

/**
 * Used to notify the mediator of keys in use by the recipient.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0211-route-coordination/README.md#keylist-update
 */
export class DidCommKeylistUpdateMessage extends DidCommMessage {
  public constructor(options: DidCommKeylistUpdateMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.updates = options.updates
    }
  }

  @IsValidMessageType(DidCommKeylistUpdateMessage.type)
  public readonly type = DidCommKeylistUpdateMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/coordinate-mediation/1.0/keylist-update')

  @Type(() => DidCommKeylistUpdate)
  @IsArray()
  @ValidateNested()
  @IsInstance(DidCommKeylistUpdate, { each: true })
  public updates!: DidCommKeylistUpdate[]
}
