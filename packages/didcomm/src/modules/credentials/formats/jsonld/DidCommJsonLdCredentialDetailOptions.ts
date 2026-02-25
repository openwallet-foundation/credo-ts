import { IsObject, IsOptional, IsString } from 'class-validator'

export interface DidCommJsonLdCredentialDetailCredentialStatusOptions {
  type: string
}

export class DidCommJsonLdCredentialDetailCredentialStatus {
  public constructor(options: DidCommJsonLdCredentialDetailCredentialStatusOptions) {
    if (options) {
      this.type = options.type
    }
  }
  @IsString()
  public type!: string
}

export interface DidCommJsonLdCredentialDetailOptionsOptions {
  proofPurpose: string
  created?: string
  domain?: string
  challenge?: string
  credentialStatus?: DidCommJsonLdCredentialDetailCredentialStatus
  proofType: string
}

export class DidCommJsonLdCredentialDetailOptions {
  public constructor(options: DidCommJsonLdCredentialDetailOptionsOptions) {
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
  public credentialStatus?: DidCommJsonLdCredentialDetailCredentialStatus
}
