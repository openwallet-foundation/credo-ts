import { Exclude, Expose } from 'class-transformer'
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator'

import { IndyCredentialInfo } from '../../credentials'

/**
 * Requested Attribute for Indy proof creation
 */
export class RequestedAttribute {
  public constructor(options: RequestedAttribute) {
    if (options) {
      this.credentialId = options.credentialId
      this.timestamp = options.timestamp
      this.revealed = options.revealed
      this.credentialInfo = options.credentialInfo
    }
  }

  @Expose({ name: 'cred_id' })
  @IsString()
  public credentialId!: string

  @Expose({ name: 'timestamp' })
  @IsInt()
  @IsOptional()
  public timestamp?: number

  @IsBoolean()
  public revealed!: boolean

  @Exclude({ toPlainOnly: true })
  public credentialInfo!: IndyCredentialInfo
}
