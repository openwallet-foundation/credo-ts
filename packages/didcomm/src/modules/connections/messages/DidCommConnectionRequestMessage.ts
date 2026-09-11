import { Type } from 'class-transformer'
import { IsInstance, IsOptional, IsString, IsUrl, ValidateNested } from 'class-validator'
import { DidCommMessage } from '../../../DidCommMessage'
import type { DidCommVersion } from '../../../util/didcommVersion'
import { IsValidMessageType, parseMessageType } from '../../../util/messageType'
import type { DidDoc } from '../models'
import { DidCommConnection } from '../models'

export interface DidCommConnectionRequestMessageOptions {
  id?: string
  label: string
  did: string
  didDoc?: DidDoc
  imageUrl?: string
}

/**
 * Message to communicate the DID document to the other agent when creating a connection
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0160-connection-protocol/README.md#1-connection-request
 */
export class DidCommConnectionRequestMessage extends DidCommMessage {
  public readonly allowDidSovPrefix = true

  /**
   * The connection protocol establishes the very relationship a DIDComm v2 envelope needs.
   * At this point no peer DID is resolvable yet, so the recipient cannot resolve a `skid`.
   * V1 authcrypt embeds the sender key in the envelope, so it works without resolution.
   */
  public readonly supportedDidCommVersions: DidCommVersion[] = ['v1']

  /**
   * Create new ConnectionRequestMessage instance.
   * @param options
   */
  public constructor(options: DidCommConnectionRequestMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.label = options.label
      this.imageUrl = options.imageUrl

      this.connection = new DidCommConnection({
        did: options.did,
        didDoc: options.didDoc,
      })
    }
  }

  @IsValidMessageType(DidCommConnectionRequestMessage.type)
  public readonly type = DidCommConnectionRequestMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/connections/1.0/request')

  @IsString()
  public label!: string

  @Type(() => DidCommConnection)
  @ValidateNested()
  @IsInstance(DidCommConnection)
  public connection!: DidCommConnection

  @IsOptional()
  @IsUrl()
  public imageUrl?: string
}
