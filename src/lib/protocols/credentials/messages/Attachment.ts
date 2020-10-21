import { Expose } from 'class-transformer';
import { v4 as uuid } from 'uuid';
import { JsonTransformer } from '../../../JsonTransformer';

interface AttachmentOptions {
  id?: string;
  mimeType: string;
  data: {
    base64: string;
  };
}

export class Attachment {
  public constructor(options: AttachmentOptions) {
    if (options) {
      this.id = options.id || uuid();
      this.mimeType = options.mimeType;
      this.data = options.data;
    }
  }

  @Expose({ name: '@id' })
  public id!: string;

  @Expose({ name: 'mime-type' })
  public mimeType!: string;

  @Expose({ name: 'data' })
  public data!: {
    base64: string;
  };

  public toJSON(): Record<string, unknown> {
    return JsonTransformer.toJSON(this);
  }
}
