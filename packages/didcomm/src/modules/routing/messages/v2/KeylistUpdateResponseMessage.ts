import { Expose, Type } from 'class-transformer'
import { IsArray, IsEnum, IsInstance, IsString, ValidateNested } from 'class-validator'

import { DidCommMessage } from '../../../../DidCommMessage'
import { IsValidMessageType, parseMessageType } from '../../../../util/messageType'

import { KeylistUpdateActionV2 } from './KeylistUpdateMessage'

export enum KeylistUpdateResultV2 {
  ClientError = 'client_error',
  ServerError = 'server_error',
  NoChange = 'no_change',
  Success = 'success',
}

export interface KeylistUpdateResponseItemV2 {
  recipientDid: string
  action: KeylistUpdateActionV2
  result: KeylistUpdateResultV2
}

export class KeylistUpdateResponseItem {
  public constructor(options: KeylistUpdateResponseItemV2) {
    if (options) {
      this.recipientDid = options.recipientDid
      this.action = options.action
      this.result = options.result
    }
  }

  @IsString()
  @Expose({ name: 'recipient_did' })
  public recipientDid!: string

  @IsEnum(KeylistUpdateActionV2)
  public action!: KeylistUpdateActionV2

  @IsEnum(KeylistUpdateResultV2)
  public result!: KeylistUpdateResultV2
}

export interface KeylistUpdateResponseMessageOptions {
  id?: string
  updated: KeylistUpdateResponseItemV2[]
  threadId?: string
}

/**
 * Keylist Update Response 2.0 - confirmation of keylist updates.
 *
 * @see https://didcomm.org/coordinate-mediation/2.0/
 */
export class KeylistUpdateResponseMessage extends DidCommMessage {
  public readonly allowQueueTransport = false
  public readonly supportedDidCommVersions: ('v1' | 'v2')[] = ['v2']

  public constructor(options: KeylistUpdateResponseMessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.updated = options.updated.map((u) => new KeylistUpdateResponseItem(u))
      if (options.threadId) {
        this.setThread({ threadId: options.threadId })
      }
    }
  }

  @IsValidMessageType(KeylistUpdateResponseMessage.type)
  public readonly type = KeylistUpdateResponseMessage.type.messageTypeUri
  public static readonly type = parseMessageType(
    'https://didcomm.org/coordinate-mediation/2.0/keylist-update-response'
  )

  @Type(() => KeylistUpdateResponseItem)
  @IsArray()
  @ValidateNested()
  @IsInstance(KeylistUpdateResponseItem, { each: true })
  public updated!: KeylistUpdateResponseItem[]
}
