import { IsString } from 'class-validator';

export class Term {
  public constructor(options: { uri: string }) {
    if (options) {
      this.uri = options.uri;
    }
  }

  @IsString()
  public uri!: string;
}
