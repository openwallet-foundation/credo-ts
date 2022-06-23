import { Expose } from 'class-transformer'
import { IsObject, IsOptional, IsString } from 'class-validator'

import { W3cCredential } from '../../../vc/models/credential/W3cCredential'

export interface JsonLdCredentialOptions {
  credential: W3cCredential
  options: {
    proofType: string
  }
  verificationMethod: string
}

/**
 * Class providing validation for the V2 json ld credential as per RFC0593 (used to sign credentials)
 *
 */
export class JsonLdCredential {
  public constructor(options: JsonLdCredentialOptions) {
    if (options) {
      this.credential = options.credential
      this.options = options.options
      if (options.verificationMethod) {
        this.verificationMethod = options.verificationMethod
      }
    }
  }

  @Expose({ name: 'credential' })
  @IsObject()
  public credential!: W3cCredential

  @Expose({ name: 'options' })
  @IsObject()
  public options!: unknown

  @Expose({ name: 'verificationMethod' })
  @IsString()
  @IsOptional()
  public verificationMethod!: string
}
