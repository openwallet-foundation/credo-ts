import { Type, Expose } from 'class-transformer'
import { Equals, IsInstance, ValidateNested } from 'class-validator'

import { DIDCommV1Message } from '../../../agent/didcomm/v1/DIDCommV1Message'
import { SignatureDecorator } from '../../../decorators/signature/SignatureDecorator'

export interface ConnectionResponseMessageOptions {
  id?: string
  threadId: string
  connectionSig: SignatureDecorator
}

/**
 * Message part of connection protocol used to complete the connection
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0160-connection-protocol/README.md#2-connection-response
 */
export class ConnectionResponseMessage extends DIDCommV1Message {
  /**
   * Create new ConnectionResponseMessage instance.
   * @param options
   */
  public constructor(options: ConnectionResponseMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.connectionSig = options.connectionSig

      this.setThread({ threadId: options.threadId })
    }
  }

  @Equals(ConnectionResponseMessage.type)
  public readonly type = ConnectionResponseMessage.type
  public static readonly type = 'https://didcomm.org/connections/1.0/response'

  @Type(() => SignatureDecorator)
  @ValidateNested()
  @IsInstance(SignatureDecorator)
  @Expose({ name: 'connection~sig' })
  public connectionSig!: SignatureDecorator
}
