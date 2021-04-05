import type { IndyCredential } from 'indy-sdk'
import { Expose, Type } from 'class-transformer'
import { IsOptional, ValidateNested } from 'class-validator'
import { JsonTransformer } from '../../../utils/JsonTransformer'

import { CredentialInfo } from './CredentialInfo'
import { RevocationInterval } from './RevocationInterval'

export class Credential {
  public constructor(options: Credential) {
    if (options) {
      this.credentialInfo = options.credentialInfo
      this.interval = options.interval
    }
  }

  @Expose({ name: 'cred_info' })
  @Type(() => CredentialInfo)
  @ValidateNested()
  public credentialInfo!: CredentialInfo

  @IsOptional()
  @Type(() => RevocationInterval)
  @ValidateNested()
  public interval?: RevocationInterval

  public toJSON(): IndyCredential {
    return (JsonTransformer.toJSON(this) as unknown) as IndyCredential
  }
}
