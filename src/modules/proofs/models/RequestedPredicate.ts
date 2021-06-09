import { Expose } from 'class-transformer'
import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator'

/**
 * Requested Predicate for Indy proof creation
 */
export class RequestedPredicate {
  public constructor(options: RequestedPredicate) {
    if (options) {
      this.credentialId = options.credentialId
      this.timestamp = options.timestamp
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
}
