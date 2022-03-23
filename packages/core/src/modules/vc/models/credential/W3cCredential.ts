import type { CredentialSubject, CredentialSubjectOptions } from './CredentialSubject'
import type { Issuer, IssuerOptions } from './Issuer'
import type { ContextDefinition } from 'jsonld'

import { Expose } from 'class-transformer'
import { IsOptional, IsString } from 'class-validator'

import { SingleOrArray } from '../../../../utils/type'
import { IsUri } from '../../../../utils/validators'
import { CREDENTIALS_CONTEXT_V1_URL } from '../../constants'
import { IssuerTransformer, CredentialSubjectTransformer } from '../../transformers'
import { IsIssuer, IsJsonLdContext, IsVerifiableCredentialType } from '../../validators'

export interface W3cCredentialOptions {
  context: Array<string> | ContextDefinition
  id?: string
  type: Array<string>
  issuer: string | IssuerOptions
  issuanceDate: string
  expirationDate?: string
  credentialSubject: SingleOrArray<CredentialSubjectOptions>
}

export class W3cCredential {
  public constructor(options: W3cCredentialOptions) {
    if (options) {
      this.context = options.context ?? [CREDENTIALS_CONTEXT_V1_URL]
      this.id = options.id
      this.type = options.type || []
      this.issuer = options.issuer
      this.issuanceDate = options.issuanceDate
      this.expirationDate = options.expirationDate
      this.credentialSubject = options.credentialSubject
    }
  }
  // export interface W3CCredentialFormat {
  //   credential: {
  //     '@context': string
  //     issuer: string
  //     type: string[]
  //     issuanceDate?: Date
  //     expirationDate?: Date
  //     credentialSubject: {
  //       [key: string]: unknown
  //     }
  //   }
  //   options?: {
  //     proofPurpose: string
  //     created: Date
  //     domain: string
  //     challenge: string
  //     proofType: ProofType
  //     credentialStatus?: {
  //       type: string
  //     }
  //   }
  //   extendedTypes?: string[]
  // }
  @Expose({ name: '@context' })
  @IsJsonLdContext()
  public context!: Array<string> | ContextDefinition

  @IsOptional()
  @IsUri()
  public id?: string
  @IsVerifiableCredentialType()
  public type!: Array<string>
  @IssuerTransformer()
  @IsIssuer()
  public issuer!: string | Issuer

  @IsString()
  public issuanceDate!: string

  @IsString()
  @IsOptional()
  public expirationDate?: string

  @CredentialSubjectTransformer()
  public credentialSubject!: SingleOrArray<CredentialSubject>
}
