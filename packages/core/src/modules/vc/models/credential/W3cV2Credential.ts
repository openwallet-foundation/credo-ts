import { Expose } from 'class-transformer'
import { IsOptional, IsRFC3339, IsUrl } from 'class-validator'
import type { JsonObject, SingleOrArray } from '../../../../types'
import { asArray, mapSingleOrArray } from '../../../../utils'
import { IsInstanceOrArrayOfInstances, IsStringOrInstanceOrArrayOfInstances } from '../../../../utils/validators'
import { CREDENTIALS_CONTEXT_V2_URL } from '../../constants'
import { IsCredentialJsonLdContext, IsCredentialType } from '../../validators'
import {
  W3cV2CredentialSchema,
  W3cV2CredentialSchemaOptions,
  W3cV2CredentialSchemaTransformer,
} from './W3cV2CredentialSchema'
import {
  W3cV2CredentialStatus,
  W3cV2CredentialStatusOptions,
  W3cV2CredentialStatusTransformer,
} from './W3cV2CredentialStatus'
import {
  W3cV2CredentialSubject,
  W3cV2CredentialSubjectOptions,
  W3cV2CredentialSubjectTransformer,
} from './W3cV2CredentialSubject'
import { W3cV2Evidence, W3cV2EvidenceOptions, W3cV2EvidenceTransformer } from './W3cV2Evidence'
import { IsW3cV2Issuer, W3cV2Issuer, W3cV2IssuerOptions, W3cV2IssuerTransformer } from './W3cV2Issuer'
import { W3cV2LocalizedValue, W3cV2LocalizedValueOptions, W3cV2LocalizedValueTransformer } from './W3cV2LocalizedValue'
import { W3cV2RefreshService, W3cV2RefreshServiceOptions, W3cV2RefreshServiceTransformer } from './W3cV2RefreshService'
import { W3cV2TermsOfUse, W3cV2TermsOfUseOptions, W3cV2TermsOfUseTransformer } from './W3cV2TermsOfUse'

export interface W3cV2CredentialOptions {
  context?: Array<string | JsonObject>
  id?: string
  type: Array<string>
  name?: string | SingleOrArray<W3cV2LocalizedValueOptions>
  description?: string | SingleOrArray<W3cV2LocalizedValueOptions>
  issuer: string | W3cV2IssuerOptions
  credentialSubject: SingleOrArray<W3cV2CredentialSubjectOptions>
  validFrom?: string
  validUntil?: string
  status?: SingleOrArray<W3cV2CredentialStatusOptions>
  credentialSchema?: SingleOrArray<W3cV2CredentialSchemaOptions>
  refreshService?: SingleOrArray<W3cV2RefreshServiceOptions>
  termsOfUse?: SingleOrArray<W3cV2TermsOfUseOptions>
  evidence?: SingleOrArray<W3cV2EvidenceOptions>
  [property: string]: unknown
}

export class W3cV2Credential {
  public constructor(options: W3cV2CredentialOptions) {
    if (options) {
      const {
        context,
        id,
        type,
        name,
        description,
        issuer,
        credentialSubject,
        validFrom,
        validUntil,
        status,
        credentialSchema,
        refreshService,
        termsOfUse,
        evidence,
        ...properties
      } = options

      this.context = context ?? [CREDENTIALS_CONTEXT_V2_URL]
      this.id = id
      this.type = type || ['VerifiableCredential']

      if (name) {
        this.name =
          typeof name === 'string'
            ? name
            : mapSingleOrArray(name, (n) => (n instanceof W3cV2LocalizedValue ? n : new W3cV2LocalizedValue(n)))
      }

      if (description) {
        this.description =
          typeof description === 'string'
            ? description
            : mapSingleOrArray(description, (n) => (n instanceof W3cV2LocalizedValue ? n : new W3cV2LocalizedValue(n)))
      }

      this.issuer = typeof issuer === 'string' || issuer instanceof W3cV2Issuer ? issuer : new W3cV2Issuer(issuer)

      this.credentialSubject = mapSingleOrArray(credentialSubject, (subject) =>
        subject instanceof W3cV2CredentialSubject
          ? subject
          : // NOTE: type assertion is needed here since TS cannot properly infer the type.
            new W3cV2CredentialSubject(subject as W3cV2CredentialSubjectOptions)
      )

      this.validFrom = validFrom
      this.validUntil = validUntil

      if (status) {
        this.status = mapSingleOrArray(status, (status) =>
          status instanceof W3cV2CredentialStatus ? status : new W3cV2CredentialStatus(status)
        )
      }

      if (credentialSchema) {
        this.credentialSchema = mapSingleOrArray(credentialSchema, (schema) =>
          schema instanceof W3cV2CredentialSchema ? schema : new W3cV2CredentialSchema(schema)
        )
      }

      this.properties = properties
    }
  }

  @Expose({ name: '@context' })
  @IsCredentialJsonLdContext({ credentialContext: CREDENTIALS_CONTEXT_V2_URL })
  public context!: Array<string | JsonObject>

  @IsOptional()
  @IsUrl()
  public id?: string

  @IsCredentialType()
  public type!: Array<string>

  @IsOptional()
  @IsStringOrInstanceOrArrayOfInstances({ classType: W3cV2LocalizedValue, allowEmptyArray: true })
  @W3cV2LocalizedValueTransformer()
  public name?: string | SingleOrArray<W3cV2LocalizedValue>

  @IsOptional()
  @IsStringOrInstanceOrArrayOfInstances({ classType: W3cV2LocalizedValue, allowEmptyArray: true })
  @W3cV2LocalizedValueTransformer()
  public description?: string | SingleOrArray<W3cV2LocalizedValue>

  @IsW3cV2Issuer()
  @W3cV2IssuerTransformer()
  public issuer!: string | W3cV2Issuer

  @IsInstanceOrArrayOfInstances({ classType: W3cV2CredentialSubject, allowEmptyArray: false })
  @W3cV2CredentialSubjectTransformer()
  public credentialSubject!: SingleOrArray<W3cV2CredentialSubject>

  @IsRFC3339()
  @IsOptional()
  public validFrom?: string

  @IsRFC3339()
  @IsOptional()
  public validUntil?: string

  @IsOptional()
  @IsInstanceOrArrayOfInstances({ classType: W3cV2CredentialStatus, allowEmptyArray: true })
  @W3cV2CredentialStatusTransformer()
  public status?: SingleOrArray<W3cV2CredentialStatus>

  @IsOptional()
  @IsInstanceOrArrayOfInstances({ classType: W3cV2CredentialSchema, allowEmptyArray: true })
  @W3cV2CredentialSchemaTransformer()
  public credentialSchema?: SingleOrArray<W3cV2CredentialSchema>

  @IsOptional()
  @IsInstanceOrArrayOfInstances({ classType: W3cV2RefreshService, allowEmptyArray: true })
  @W3cV2RefreshServiceTransformer()
  public refreshService?: SingleOrArray<W3cV2RefreshService>

  @IsOptional()
  @IsInstanceOrArrayOfInstances({ classType: W3cV2Evidence, allowEmptyArray: true })
  @W3cV2EvidenceTransformer()
  public evidence?: SingleOrArray<W3cV2Evidence>

  @IsOptional()
  @IsInstanceOrArrayOfInstances({ classType: W3cV2TermsOfUse, allowEmptyArray: true })
  @W3cV2TermsOfUseTransformer()
  public termsOfUse?: SingleOrArray<W3cV2TermsOfUse>

  @IsOptional()
  public properties?: Record<string, unknown>

  public get issuerId(): string {
    return this.issuer instanceof W3cV2Issuer ? this.issuer.id : this.issuer
  }

  public get credentialSchemaIds(): string[] {
    if (!this.credentialSchema) {
      return []
    }

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
}
