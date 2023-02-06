import type { CredentialSubjectOptions } from './CredentialSubject'
import type { IssuerOptions } from './Issuer'
import type { JsonObject } from '../../../../types'
import type { ValidationOptions } from 'class-validator'

import { Expose, Type } from 'class-transformer'
import { buildMessage, IsOptional, IsString, ValidateBy } from 'class-validator'

import { SingleOrArray } from '../../../../utils/type'
import { IsInstanceOrArrayOfInstances, IsUri } from '../../../../utils/validators'
import { CREDENTIALS_CONTEXT_V1_URL, VERIFIABLE_CREDENTIAL_TYPE } from '../../constants'
import { IsJsonLdContext } from '../../validators'

import { CredentialSchema } from './CredentialSchema'
import { CredentialSubject } from './CredentialSubject'
import { Issuer, IsIssuer, IssuerTransformer } from './Issuer'

export interface W3cCredentialOptions {
  context: Array<string> | JsonObject
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

  @Expose({ name: '@context' })
  @IsJsonLdContext()
  public context!: Array<string | JsonObject> | JsonObject

  @IsOptional()
  @IsUri()
  public id?: string

  @IsCredentialType()
  public type!: Array<string>

  @IssuerTransformer()
  @IsIssuer()
  public issuer!: string | Issuer

  @IsString()
  public issuanceDate!: string

  @IsString()
  @IsOptional()
  public expirationDate?: string

  @Type(() => CredentialSubject)
  @IsInstanceOrArrayOfInstances({ classType: CredentialSubject })
  public credentialSubject!: SingleOrArray<CredentialSubject>

  @IsOptional()
  @Type(() => CredentialSchema)
  @IsInstanceOrArrayOfInstances({ classType: CredentialSchema })
  public credentialSchema?: SingleOrArray<CredentialSchema>

  public get issuerId(): string {
    return this.issuer instanceof Issuer ? this.issuer.id : this.issuer
  }

  public get credentialSchemaIds(): string[] {
    if (!this.credentialSchema) return []

    if (Array.isArray(this.credentialSchema)) {
      return this.credentialSchema.map((credentialSchema) => credentialSchema.id)
    }

    return [this.credentialSchema.id]
  }

  public get credentialSubjectIds(): string[] {
    if (Array.isArray(this.credentialSubject)) {
      return this.credentialSubject.map((credentialSubject) => credentialSubject.id)
    }

    return [this.credentialSubject.id]
  }

  public get contexts(): Array<string | JsonObject> {
    if (Array.isArray(this.context)) {
      return this.context.filter((x) => typeof x === 'string')
    }

    if (typeof this.context === 'string') {
      return [this.context]
    }

    return [this.context.id as string]
  }
}

// Custom validator

export function IsCredentialType(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'IsVerifiableCredentialType',
      validator: {
        validate: (value): boolean => {
          if (Array.isArray(value)) {
            return value.includes(VERIFIABLE_CREDENTIAL_TYPE)
          }
          return false
        },
        defaultMessage: buildMessage(
          (eachPrefix) => eachPrefix + '$property must be an array of strings which includes "VerifiableCredential"',
          validationOptions
        ),
      },
    },
    validationOptions
  )
}
