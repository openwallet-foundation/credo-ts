import type { IndyCredentialInfoOptions } from '../../../../credentials/formats/indy/models/IndyCredentialInfo'

import { Exclude, Expose } from 'class-transformer'
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator'

import { IndyCredentialInfo } from '../../../../credentials/formats/indy/models/IndyCredentialInfo'

export interface RequestedAttributeOptions {
  credentialId: string
  timestamp?: number
  revealed: boolean
  credentialInfo?: IndyCredentialInfoOptions
  revoked?: boolean
}

/**
 * Requested Attribute for Indy proof creation
 */
export class RequestedAttribute {
  public constructor(options: RequestedAttributeOptions) {
    if (options) {
      this.credentialId = options.credentialId
      this.timestamp = options.timestamp
      this.revealed = options.revealed
      this.credentialInfo = options.credentialInfo ? new IndyCredentialInfo(options.credentialInfo) : undefined
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

  @IsBoolean()
  public revealed!: boolean

  @Exclude({ toPlainOnly: true })
  public credentialInfo?: IndyCredentialInfo

  @Exclude({ toPlainOnly: true })
  public revoked?: boolean
}
