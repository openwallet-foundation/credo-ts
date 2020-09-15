import { Expose } from 'class-transformer';

export class Attachment {
  public constructor(options: Attachment) {
    if (options) {
      this.id = options.id;
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
}
