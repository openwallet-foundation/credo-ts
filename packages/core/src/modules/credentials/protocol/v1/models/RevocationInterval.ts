import { IsInt, IsOptional } from 'class-validator'

export class RevocationInterval {
  public constructor(options: { from?: number; to?: number }) {
    if (options) {
      this.from = options.from
      this.to = options.to
    }
  }

  @IsInt()
  @IsOptional()
  public from?: number

  @IsInt()
  @IsOptional()
  public to?: number
}
