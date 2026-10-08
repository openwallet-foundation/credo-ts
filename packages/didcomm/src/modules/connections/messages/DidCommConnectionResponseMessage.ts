import { Expose, Type } from 'class-transformer'
import { IsInstance, ValidateNested } from 'class-validator'

import { DidCommMessage } from '../../../DidCommMessage'
import { SignatureDecorator } from '../../../decorators/signature/SignatureDecorator'
import type { DidCommVersion } from '../../../util/didcommVersion'
import { IsValidMessageType, parseMessageType } from '../../../util/messageType'

export interface DidCommConnectionResponseMessageOptions {
  id?: string
  threadId: string
  connectionSig: SignatureDecorator
}

/**
 * Message part of connection protocol used to complete the connection
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0160-connection-protocol/README.md#2-connection-response
 */
export class DidCommConnectionResponseMessage extends DidCommMessage {
  public readonly allowDidSovPrefix = true

  /**
   * See {@link DidCommConnectionRequestMessage.supportedDidCommVersions}. The response completes
   * the same handshake and has the same resolution constraint.
   */
  public readonly supportedDidCommVersions: DidCommVersion[] = ['v1']

  /**
   * Create new ConnectionResponseMessage instance.
   * @param options
   */
  public constructor(options: DidCommConnectionResponseMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.connectionSig = options.connectionSig

      this.setThread({ threadId: options.threadId })
    }
  }

  @IsValidMessageType(DidCommConnectionResponseMessage.type)
  public readonly type = DidCommConnectionResponseMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/connections/1.0/response')

  @Type(() => SignatureDecorator)
  @ValidateNested()
  @IsInstance(SignatureDecorator)
  @Expose({ name: 'connection~sig' })
  public connectionSig!: SignatureDecorator
}
