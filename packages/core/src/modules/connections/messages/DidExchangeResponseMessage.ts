import { Type, Expose } from 'class-transformer'
import { Equals, IsString } from 'class-validator'

import { AgentMessage } from '../../../agent/AgentMessage'
import { Attachment } from '../../../decorators/attachment/Attachment'

export interface DidExchangeResponseMessageOptions {
  id?: string
  threadId: string
  did: string
}

/**
 * Message part of connection protocol used to complete the connection
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/main/features/0023-did-exchange/README.md#2-exchange-response
 */
export class DidExchangeResponseMessage extends AgentMessage {
  /**
   * Create new DidExchangeResponseMessage instance.
   * @param options
   */
  public constructor(options: DidExchangeResponseMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.did = options.did

      this.setThread({
        threadId: options.threadId,
      })
    }
  }

  @Equals(DidExchangeResponseMessage.type)
  public readonly type = DidExchangeResponseMessage.type
  public static readonly type = 'https://didcomm.org/didexchange/1.0/response'

  @IsString()
  public readonly did!: string

  @Expose({ name: 'did_doc~attach' })
  @Type(() => Attachment)
  public didDoc?: Attachment
}
