import { IsObject, IsOptional, IsString } from 'class-validator'

export interface JsonLdOptionsCredentialStatusOptions {
  type: string
}

export class JsonLdOptionsCredentialStatus {
  public constructor(options: JsonLdOptionsCredentialStatusOptions) {
    if (options) {
      this.type = options.type
    }
  }
  @IsString()
  public type!: string
}

export interface JsonLdOptionsRFC0593Options {
  proofPurpose: string
  created?: string
  domain?: string
  challenge?: string
  credentialStatus?: JsonLdOptionsCredentialStatus
  proofType: string
}

export class JsonLdOptionsRFC0593 {
  public constructor(options: JsonLdOptionsRFC0593Options) {
    if (options) {
      this.proofPurpose = options.proofPurpose
      this.created = options.created
      this.domain = options.domain
      this.challenge = options.challenge
      this.credentialStatus = options.credentialStatus
      this.proofType = options.proofType
    }
  }

  @IsString()
  public proofPurpose!: string

  @IsString()
  @IsOptional()
  public created?: string

  @IsString()
  @IsOptional()
  public domain?: string

  @IsString()
  @IsOptional()
  public challenge?: string

  @IsString()
  public proofType!: string

  @IsOptional()
  @IsObject()
  public credentialStatus?: JsonLdOptionsCredentialStatus
}
