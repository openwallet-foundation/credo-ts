import { IsString } from 'class-validator';
import { Expose, Type } from 'class-transformer';

import { DidDoc } from './DidDoc';

export interface ConnectionOptions {
  did: string;
  didDoc?: DidDoc;
}

export class Connection {
  constructor(options: ConnectionOptions) {
    if (options) {
      this.did = options.did;
      this.didDoc = options.didDoc;
    }
  }

  @IsString()
  @Expose({ name: 'DID' })
  did!: string;

  @Expose({ name: 'DIDDoc' })
  @Type(() => DidDoc)
  didDoc?: DidDoc;
}
