import { IsString } from 'class-validator';
import { Expose, Transform } from 'class-transformer';

import { DidDoc } from './DidDoc';

export interface ConnectionOptions {
  did: string;
  didDoc?: DidDoc;
}

export class Connection {
  public constructor(options: ConnectionOptions) {
    if (options) {
      this.did = options.did;
      this.didDoc = options.didDoc;
    }
  }

  @IsString()
  @Expose({ name: 'DID' })
  public did!: string;

  @Expose({ name: 'DIDDoc' })
  // TODO: add type for DidDoc
  // When we add the @Type json object DidDoc parameter will be cast to DidDoc class instance
  // However the DidDoc class is not yet decorated using class-transformer
  // meaning it will give errors because the class will be invalid.
  // for now the DidDoc class is however correctly cast from class instance to json
  // @Type(() => DidDoc)
  // This way we also don't need the custom transformer
  @Transform((value: DidDoc | undefined) => (value?.toJSON ? value.toJSON() : value), { toPlainOnly: true })
  public didDoc?: DidDoc;
}
