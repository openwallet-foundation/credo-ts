import { Exclude, Expose } from 'class-transformer'
import { IsInt, IsOptional, IsString } from 'class-validator'

import { IndyCredentialInfo } from '../../../../credentials'

/**
 * Requested Predicate for Indy proof creation
 */
export class RequestedPredicate {
  public constructor(options: RequestedPredicate) {
    if (options) {
      this.credentialId = options.credentialId
      this.timestamp = options.timestamp
      this.credentialInfo = options.credentialInfo
      this.revoked = options.revoked
    }
  }

  @Expose({ name: 'cred_id' })
  @IsString()
  public credentialId!: string

  @Expose({ name: 'timestamp' })
  @IsInt()
  @IsOptional()
  public timestamp?: number

  @Exclude({ toPlainOnly: true })
  public credentialInfo?: IndyCredentialInfo

  @Exclude({ toPlainOnly: true })
  public revoked?: boolean
}
