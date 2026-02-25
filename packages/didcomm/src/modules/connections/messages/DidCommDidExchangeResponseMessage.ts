import { Expose, Type } from 'class-transformer'
import { IsOptional, IsString, ValidateNested } from 'class-validator'

import { DidCommMessage } from '../../../DidCommMessage'
import { DidCommAttachment } from '../../../decorators/attachment/DidCommAttachment'
import { IsValidMessageType, parseMessageType } from '../../../util/messageType'

export interface DidCommDidExchangeResponseMessageOptions {
  id?: string
  threadId: string
  did: string
}

/**
 * Message part of connection protocol used to complete the connection
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/main/features/0023-did-exchange/README.md#2-exchange-response
 */
export class DidCommDidExchangeResponseMessage extends DidCommMessage {
  /**
   * Create new DidExchangeResponseMessage instance.
   * @param options
   */
  public constructor(options: DidCommDidExchangeResponseMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.did = options.did

      this.setThread({
        threadId: options.threadId,
      })
    }
  }

  @IsValidMessageType(DidCommDidExchangeResponseMessage.type)
  public readonly type = DidCommDidExchangeResponseMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/didexchange/1.1/response')

  @IsString()
  public readonly did!: string

  @Expose({ name: 'did_doc~attach' })
  @IsOptional()
  @Type(() => DidCommAttachment)
  @ValidateNested()
  public didDoc?: DidCommAttachment

  @Expose({ name: 'did_rotate~attach' })
  @IsOptional()
  @Type(() => DidCommAttachment)
  @ValidateNested()
  public didRotate?: DidCommAttachment
}
