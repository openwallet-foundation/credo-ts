import type { W3cCredentialSubjectOptions } from './W3cCredentialSubject'
import type { W3cIssuerOptions } from './W3cIssuer'
import type { JsonObject } from '../../../../types'
import type { ValidationOptions } from 'class-validator'

import { Expose, Type } from 'class-transformer'
import { IsInstance, buildMessage, IsOptional, IsRFC3339, ValidateBy, ValidateNested } from 'class-validator'

import { asArray, JsonEncoder, JsonTransformer } from '../../../../utils'
import { SingleOrArray } from '../../../../utils/type'
import { IsInstanceOrArrayOfInstances, IsUri } from '../../../../utils/validators'
import { CREDENTIALS_CONTEXT_V1_URL, VERIFIABLE_CREDENTIAL_TYPE } from '../../constants'
import { IsCredentialJsonLdContext } from '../../validators'

import { W3cCredentialSchema } from './W3cCredentialSchema'
import { W3cCredentialStatus } from './W3cCredentialStatus'
import { W3cCredentialSubject } from './W3cCredentialSubject'
import { W3cIssuer, IsW3cIssuer, W3cIssuerTransformer } from './W3cIssuer'

export interface W3cCredentialOptions {
  context?: Array<string | JsonObject>
  id?: string
  type: Array<string>
  issuer: string | W3cIssuerOptions
  issuanceDate: string
  expirationDate?: string
  credentialSubject: SingleOrArray<W3cCredentialSubjectOptions>
  credentialStatus?: W3cCredentialStatus
}

export class W3cCredential {
  public constructor(options: W3cCredentialOptions) {
    if (options) {
      this.context = options.context ?? [CREDENTIALS_CONTEXT_V1_URL]
      this.id = options.id
      this.type = options.type || ['VerifiableCredential']
      this.issuer =
        typeof options.issuer === 'string' || options.issuer instanceof W3cIssuer
          ? options.issuer
          : new W3cIssuer(options.issuer)
      this.issuanceDate = options.issuanceDate
      this.expirationDate = options.expirationDate
      this.credentialSubject =
        options.credentialSubject instanceof W3cCredentialSubject
          ? options.credentialSubject
          : !Array.isArray(options.credentialSubject)
          ? new W3cCredentialSubject(options.credentialSubject)
          : options.credentialSubject.map((s) => (s instanceof W3cCredentialSubject ? s : new W3cCredentialSubject(s)))

      if (options.credentialStatus) {
        this.credentialStatus =
          options.credentialStatus instanceof W3cCredentialStatus
            ? options.credentialStatus
            : new W3cCredentialStatus(options.credentialStatus)
      }
    }
  }

  @Expose({ name: '@context' })
  @IsCredentialJsonLdContext()
  public context!: Array<string | JsonObject>

  @IsOptional()
  @IsUri()
  public id?: string

  @IsCredentialType()
  public type!: Array<string>

  @W3cIssuerTransformer()
  @IsW3cIssuer()
  public issuer!: string | W3cIssuer

  @IsRFC3339()
  public issuanceDate!: string

  @IsRFC3339()
  @IsOptional()
  public expirationDate?: string

  @Type(() => W3cCredentialSubject)
  @ValidateNested({ each: true })
  @IsInstanceOrArrayOfInstances({ classType: W3cCredentialSubject })
  public credentialSubject!: SingleOrArray<W3cCredentialSubject>

  @IsOptional()
  @Type(() => W3cCredentialSchema)
  @ValidateNested({ each: true })
  @IsInstanceOrArrayOfInstances({ classType: W3cCredentialSchema, allowEmptyArray: true })
  public credentialSchema?: SingleOrArray<W3cCredentialSchema>

  @IsOptional()
  @Type(() => W3cCredentialStatus)
  @ValidateNested({ each: true })
  @IsInstance(W3cCredentialStatus)
  public credentialStatus?: W3cCredentialStatus

  public get issuerId(): string {
    return this.issuer instanceof W3cIssuer ? this.issuer.id : this.issuer
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
      return this.credentialSubject
        .map((credentialSubject) => credentialSubject.id)
        .filter((v): v is string => v !== undefined)
    }

    return this.credentialSubject.id ? [this.credentialSubject.id] : []
  }

  public get contexts(): Array<string | JsonObject> {
    return asArray(this.context)
  }

  public static fromJson(json: Record<string, unknown>) {
    return JsonTransformer.fromJSON(json, W3cCredential)
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
