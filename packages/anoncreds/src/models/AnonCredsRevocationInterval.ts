import { IsInt, IsOptional } from 'class-validator'

export class AnonCredsRevocationInterval {
  public constructor(options: AnonCredsRevocationInterval) {
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
