import { Expose, Type } from 'class-transformer'
import { IsOptional, ValidateNested } from 'class-validator'
import type { IndyCredential } from 'indy-sdk'

import { JsonTransformer } from '../../../utils/JsonTransformer'

import { IndyCredentialInfo } from './IndyCredentialInfo'
import { RevocationInterval } from './RevocationInterval'

export class Credential {
  public constructor(options: Credential) {
    if (options) {
      this.credentialInfo = options.credentialInfo
      this.interval = options.interval
    }
  }

  @Expose({ name: 'cred_info' })
  @Type(() => IndyCredentialInfo)
  @ValidateNested()
  public credentialInfo!: IndyCredentialInfo

  @IsOptional()
  @Type(() => RevocationInterval)
  @ValidateNested()
  public interval?: RevocationInterval

  public toJSON(): IndyCredential {
    return JsonTransformer.toJSON(this) as unknown as IndyCredential
  }
}
