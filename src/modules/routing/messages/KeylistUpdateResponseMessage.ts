import type { Verkey } from 'indy-sdk'
import { Equals, IsArray, ValidateNested, IsString, IsEnum } from 'class-validator'
import { Type } from 'class-transformer'

import { AgentMessage } from '../../../agent/AgentMessage'
import { RoutingMessageType as MessageType } from './RoutingMessageType'
import { KeylistUpdateAction } from './KeylistUpdateMessage'

export interface KeylistUpdateResponseMessageOptions {
  id?: string
  updated: KeylistUpdated[]
}

/**
 * Used to notify the mediator of keys in use by the recipient.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0211-route-coordination/README.md#keylist-update
 */
export class KeylistUpdateResponseMessage extends AgentMessage {
  public constructor(options: KeylistUpdateResponseMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.updated = options.updated
    }
  }

  @Equals(KeylistUpdateResponseMessage.type)
  public readonly type = KeylistUpdateResponseMessage.type
  public static readonly type = MessageType.KeylistUpdateResponse

  @Type(() => KeylistUpdated)
  @IsArray()
  @ValidateNested()
  public updated!: KeylistUpdated[]
}

export enum KeylistUpdateResult {
  client_error = 'client_error',
  server_error = 'server_error',
  no_change = 'no_change',
  success = 'success',
}

export class KeylistUpdated {
  public constructor(options: { recipientKey: Verkey; action: KeylistUpdateAction }) {
    if (options) {
      this.recipientKey = options.recipientKey
      this.action = options.action
    }
  }

  @IsString()
  public recipientKey!: Verkey

  @IsEnum(KeylistUpdateAction)
  public action!: KeylistUpdateAction

  @IsEnum(KeylistUpdateResult)
  public result!: KeylistUpdateResult
}
