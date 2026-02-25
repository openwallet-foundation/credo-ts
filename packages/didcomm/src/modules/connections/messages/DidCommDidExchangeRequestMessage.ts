import { Expose, Type } from 'class-transformer'
import { IsOptional, IsString, ValidateNested } from 'class-validator'

import { DidCommMessage } from '../../../DidCommMessage'
import { DidCommAttachment } from '../../../decorators/attachment/DidCommAttachment'
import { IsValidMessageType, parseMessageType } from '../../../util/messageType'

export interface DidCommDidExchangeRequestMessageOptions {
  id?: string
  parentThreadId: string
  label: string
  goalCode?: string
  goal?: string
  did: string
}

/**
 * Message to communicate the DID document to the other agent when creating a connection
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/main/features/0023-did-exchange/README.md#1-exchange-request
 */
export class DidCommDidExchangeRequestMessage extends DidCommMessage {
  /**
   * Create new DidExchangeRequestMessage instance.
   * @param options
   */
  public constructor(options: DidCommDidExchangeRequestMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.label = options.label
      this.goalCode = options.goalCode
      this.goal = options.goal
      this.did = options.did

      this.setThread({
        parentThreadId: options.parentThreadId,
      })
    }
  }

  @IsValidMessageType(DidCommDidExchangeRequestMessage.type)
  public readonly type = DidCommDidExchangeRequestMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/didexchange/1.1/request')

  @IsString()
  public readonly label?: string

  @Expose({ name: 'goal_code' })
  @IsOptional()
  public readonly goalCode?: string

  @IsString()
  @IsOptional()
  public readonly goal?: string

  @IsString()
  public readonly did!: string

  @Expose({ name: 'did_doc~attach' })
  @Type(() => DidCommAttachment)
  @ValidateNested()
  public didDoc?: DidCommAttachment
}
