import { IsString, ValidateNested } from 'class-validator'
import { Expose, Type } from 'class-transformer'

import { DidDoc } from './did/DidDoc'

export interface ConnectionOptions {
  did: string
  didDoc?: DidDoc
}

export class Connection {
  public constructor(options: ConnectionOptions) {
    if (options) {
      this.did = options.did
      this.didDoc = options.didDoc
    }
  }

  @IsString()
  @Expose({ name: 'DID' })
  public did!: string

  @Expose({ name: 'DIDDoc' })
  @Type(() => DidDoc)
  @ValidateNested()
  public didDoc?: DidDoc
}
