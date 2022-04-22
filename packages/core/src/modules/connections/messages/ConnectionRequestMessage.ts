import type { DidDoc } from '../models'

import { Type } from 'class-transformer'
import { Equals, IsInstance, IsOptional, IsString, IsUrl, ValidateNested } from 'class-validator'

import { DIDCommV1Message } from '../../../agent/didcomm/v1/DIDCommV1Message'
import { Connection } from '../models'

export interface ConnectionRequestMessageOptions {
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
export class ConnectionRequestMessage extends DIDCommV1Message {
  /**
   * Create new ConnectionRequestMessage instance.
   * @param options
   */
  public constructor(options: ConnectionRequestMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.label = options.label
      this.imageUrl = options.imageUrl

      this.connection = new Connection({
        did: options.did,
        didDoc: options.didDoc,
      })
    }
  }

  @Equals(ConnectionRequestMessage.type)
  public readonly type = ConnectionRequestMessage.type
  public static readonly type = 'https://didcomm.org/connections/1.0/request'

  @IsString()
  public label!: string

  @Type(() => Connection)
  @ValidateNested()
  @IsInstance(Connection)
  public connection!: Connection

  @IsOptional()
  @IsUrl()
  public imageUrl?: string
}
