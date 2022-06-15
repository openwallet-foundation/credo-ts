import type * as Indy from 'indy-sdk'

import { Expose, Type } from 'class-transformer'
import { IsInstance, IsOptional, ValidateNested } from 'class-validator'

import { JsonTransformer } from '../../../../../utils/JsonTransformer'

import { IndyCredentialInfo } from './IndyCredentialInfo'
import { IndyRevocationInterval } from './IndyRevocationInterval'

export class IndyCredential {
  public constructor(options: IndyCredential) {
    if (options) {
      this.credentialInfo = options.credentialInfo
      this.interval = options.interval
    }
  }

  @Expose({ name: 'cred_info' })
  @Type(() => IndyCredentialInfo)
  @ValidateNested()
  @IsInstance(IndyCredentialInfo)
  public credentialInfo!: IndyCredentialInfo

  @IsOptional()
  @Type(() => IndyRevocationInterval)
  @ValidateNested()
  @IsInstance(IndyRevocationInterval)
  public interval?: IndyRevocationInterval

  public toJSON(): Indy.IndyCredential {
    return JsonTransformer.toJSON(this) as unknown as Indy.IndyCredential
  }
}
