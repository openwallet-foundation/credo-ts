import { IsOptional, IsString } from 'class-validator'

export interface W3CAnonCredsCredentialMetadataOptions {
  credentialId: string
  methodName: string
  credentialRevocationId?: string
  linkSecretId: string
}

export class W3cAnonCredsCredentialMetadata {
  public constructor(options: W3CAnonCredsCredentialMetadataOptions) {
    if (options) {
      this.credentialId = options.credentialId
      this.methodName = options.methodName
      this.credentialRevocationId = options.credentialRevocationId
      this.linkSecretId = options.linkSecretId
    }
  }

  @IsString()
  public credentialId!: string

  @IsString()
  @IsOptional()
  public credentialRevocationId?: string

  @IsString()
  public linkSecretId!: string

  /**
   * AnonCreds method name. We don't use names explicitly from the registry (there's no identifier for a registry)
   * @see https://hyperledger.github.io/anoncreds-methods-registry/
   */
  @IsString()
  public methodName!: string
}
