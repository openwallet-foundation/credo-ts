import { IsBoolean, IsInt, IsOptional, IsPositive, IsString } from 'class-validator'
import { Expose } from 'class-transformer'

/**
 * Requested Attribute for Indy proof creation
 */
export class RequestedAttribute {
  public constructor(options: RequestedAttribute) {
    if (options) {
      this.credentialId = options.credentialId
      this.timestamp = options.timestamp
      this.revealed = options.revealed
    }
  }

  @Expose({ name: 'cred_id' })
  @IsString()
  public credentialId!: string

  @Expose({ name: 'timestamp' })
  @IsPositive()
  @IsInt()
  @IsOptional()
  public timestamp?: number

  @IsBoolean()
  public revealed!: boolean
}
