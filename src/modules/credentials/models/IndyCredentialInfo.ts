import { Expose } from 'class-transformer'
import { IsOptional, IsString } from 'class-validator'
import type { IndyCredentialInfo as IndySDKCredentialInfo } from 'indy-sdk'

import { JsonTransformer } from '../../../utils/JsonTransformer'

export class IndyCredentialInfo {
  public constructor(options: IndyCredentialInfo) {
    if (options) {
      this.referent = options.referent
      this.attributes = options.attributes
      this.schemaId = options.schemaId
      this.credentialDefinitionId = options.credentialDefinitionId
      this.revocationRegistryId = options.revocationRegistryId
      this.credentialRevocationId = options.credentialRevocationId
    }
  }

  /**
   * Credential ID in the wallet
   */
  @IsString()
  public referent!: string

  @Expose({ name: 'attrs' })
  @IsString({ each: true })
  public attributes!: Record<string, string>

  @Expose({ name: 'schema_id' })
  @IsString()
  public schemaId!: string

  @Expose({ name: 'cred_def_id' })
  @IsString()
  public credentialDefinitionId!: string

  @Expose({ name: 'rev_reg_id' })
  @IsString()
  @IsOptional()
  public revocationRegistryId?: string

  @Expose({ name: 'cred_rev_id' })
  @IsString()
  @IsOptional()
  public credentialRevocationId?: string

  public toJSON(): IndySDKCredentialInfo {
    return JsonTransformer.toJSON(this) as unknown as IndySDKCredentialInfo
  }
}
