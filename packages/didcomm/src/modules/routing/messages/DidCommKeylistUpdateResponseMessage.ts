import { Expose, Type } from 'class-transformer'
import { IsArray, IsEnum, IsInstance, IsString, ValidateNested } from 'class-validator'

import { DidCommMessage } from '../../../DidCommMessage'
import { IsValidMessageType, parseMessageType } from '../../../util/messageType'

import { DidCommKeylistUpdateAction } from './DidCommKeylistUpdateMessage'

export enum DidCommKeylistUpdateResult {
  ClientError = 'client_error',
  ServerError = 'server_error',
  NoChange = 'no_change',
  Success = 'success',
}

export class DidCommKeylistUpdated {
  public constructor(options: {
    recipientKey: string
    action: DidCommKeylistUpdateAction
    result: DidCommKeylistUpdateResult
  }) {
    if (options) {
      this.recipientKey = options.recipientKey
      this.action = options.action
      this.result = options.result
    }
  }

  @IsString()
  @Expose({ name: 'recipient_key' })
  public recipientKey!: string

  @IsEnum(DidCommKeylistUpdateAction)
  public action!: DidCommKeylistUpdateAction

  @IsEnum(DidCommKeylistUpdateResult)
  public result!: DidCommKeylistUpdateResult
}

export interface DidCommKeylistUpdateResponseMessageOptions {
  id?: string
  keylist: DidCommKeylistUpdated[]
  threadId: string
}

/**
 * Used to notify an edge agent with the result of updating the routing keys in the mediator.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0211-route-coordination/README.md#keylist-update-response
 */
export class DidCommKeylistUpdateResponseMessage extends DidCommMessage {
  public constructor(options: DidCommKeylistUpdateResponseMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.updated = options.keylist
      this.setThread({
        threadId: options.threadId,
      })
    }
  }

  @IsValidMessageType(DidCommKeylistUpdateResponseMessage.type)
  public readonly type = DidCommKeylistUpdateResponseMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/coordinate-mediation/1.0/keylist-update-response')

  @Type(() => DidCommKeylistUpdated)
  @IsArray()
  @ValidateNested()
  @IsInstance(DidCommKeylistUpdated, { each: true })
  public updated!: DidCommKeylistUpdated[]
}
