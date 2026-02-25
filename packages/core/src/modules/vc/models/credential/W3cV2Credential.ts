import { Expose, plainToClassFromExist, Type } from 'class-transformer'
import { IsOptional, IsRFC3339, ValidateNested } from 'class-validator'
import type { JsonObject, SingleOrArray } from '../../../../types'
import { asArray, JsonTransformer, mapSingleOrArray } from '../../../../utils'
import {
  IsInstanceOrArrayOfInstances,
  IsNever,
  IsStringOrInstanceOrArrayOfInstances,
  IsUri,
} from '../../../../utils/validators'
import { CREDENTIALS_CONTEXT_V2_URL } from '../../constants'
import { IsCredentialJsonLdContext, IsCredentialType } from '../../validators'
import { W3cV2CredentialSchema, type W3cV2CredentialSchemaOptions } from './W3cV2CredentialSchema'
import { W3cV2CredentialStatus, type W3cV2CredentialStatusOptions } from './W3cV2CredentialStatus'
import { W3cV2CredentialSubject, type W3cV2CredentialSubjectOptions } from './W3cV2CredentialSubject'
import { W3cV2Evidence, type W3cV2EvidenceOptions } from './W3cV2Evidence'
import { IsW3cV2Issuer, W3cV2Issuer, type W3cV2IssuerOptions, W3cV2IssuerTransformer } from './W3cV2Issuer'
import type { W3cV2JsonCredential } from './W3cV2JsonCredential'
import {
  W3cV2LocalizedValue,
  type W3cV2LocalizedValueOptions,
  W3cV2LocalizedValueTransformer,
} from './W3cV2LocalizedValue'
import { W3cV2RefreshService, type W3cV2RefreshServiceOptions } from './W3cV2RefreshService'
import { W3cV2TermsOfUse, type W3cV2TermsOfUseOptions } from './W3cV2TermsOfUse'

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
  credentialStatus?: SingleOrArray<W3cV2CredentialStatusOptions>
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
        credentialStatus,
        credentialSchema,
        refreshService,
        termsOfUse,
        evidence,
        ...rest
      } = options

      plainToClassFromExist(this, rest)

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

      if (credentialStatus) {
        this.credentialStatus = mapSingleOrArray(credentialStatus, (status) =>
          status instanceof W3cV2CredentialStatus ? status : new W3cV2CredentialStatus(status)
        )
      }

      if (credentialSchema) {
        this.credentialSchema = mapSingleOrArray(credentialSchema, (schema) =>
          schema instanceof W3cV2CredentialSchema ? schema : new W3cV2CredentialSchema(schema)
        )
      }

      if (refreshService) {
        this.refreshService = mapSingleOrArray(refreshService, (service) =>
          service instanceof W3cV2RefreshService ? service : new W3cV2RefreshService(service)
        )
      }

      if (termsOfUse) {
        this.termsOfUse = mapSingleOrArray(termsOfUse, (tos) =>
          tos instanceof W3cV2TermsOfUse ? tos : new W3cV2TermsOfUse(tos)
        )
      }

      if (evidence) {
        this.evidence = mapSingleOrArray(evidence, (evidence) =>
          evidence instanceof W3cV2Evidence ? evidence : new W3cV2Evidence(evidence)
        )
      }
    }
  }

  @Expose({ name: '@context' })
  @IsCredentialJsonLdContext({ credentialContext: CREDENTIALS_CONTEXT_V2_URL })
  public context!: Array<string | JsonObject>

  @IsOptional()
  @IsUri()
  public id?: string

  @IsCredentialType()
  public type!: SingleOrArray<string>

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

  @Type(() => W3cV2CredentialSubject)
  @ValidateNested({ each: true })
  @IsInstanceOrArrayOfInstances({ classType: W3cV2CredentialSubject })
  public credentialSubject!: SingleOrArray<W3cV2CredentialSubject>

  @IsRFC3339()
  @IsOptional()
  public validFrom?: string

  @IsRFC3339()
  @IsOptional()
  public validUntil?: string

  @IsOptional()
  @Type(() => W3cV2CredentialStatus)
  @ValidateNested({ each: true })
  @IsInstanceOrArrayOfInstances({ classType: W3cV2CredentialStatus, allowEmptyArray: true })
  public credentialStatus?: SingleOrArray<W3cV2CredentialStatus>

  @IsOptional()
  @Type(() => W3cV2CredentialSchema)
  @ValidateNested({ each: true })
  @IsInstanceOrArrayOfInstances({ classType: W3cV2CredentialSchema, allowEmptyArray: true })
  public credentialSchema?: SingleOrArray<W3cV2CredentialSchema>

  @IsOptional()
  @Type(() => W3cV2RefreshService)
  @ValidateNested({ each: true })
  @IsInstanceOrArrayOfInstances({ classType: W3cV2RefreshService, allowEmptyArray: true })
  public refreshService?: SingleOrArray<W3cV2RefreshService>

  @IsOptional()
  @Type(() => W3cV2Evidence)
  @ValidateNested({ each: true })
  @IsInstanceOrArrayOfInstances({ classType: W3cV2Evidence, allowEmptyArray: true })
  public evidence?: SingleOrArray<W3cV2Evidence>

  @IsOptional()
  @Type(() => W3cV2TermsOfUse)
  @ValidateNested({ each: true })
  @IsInstanceOrArrayOfInstances({ classType: W3cV2TermsOfUse, allowEmptyArray: true })
  public termsOfUse?: SingleOrArray<W3cV2TermsOfUse>

  @IsNever()
  public vc?: never

  @IsNever()
  public vp?: never;

  [property: string]: unknown

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

  public toJSON(): W3cV2JsonCredential {
    return JsonTransformer.toJSON(this) as W3cV2JsonCredential
  }
}
