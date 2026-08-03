import { Expose, Type } from 'class-transformer'
import { IsInstance, IsOptional, ValidateNested } from 'class-validator'
import type { JsonObject, SingleOrArray } from '../../../../types'
import { asArray, JsonTransformer, mapSingleOrArray } from '../../../../utils'
import { IsInstanceOrArrayOfInstances, IsUri } from '../../../../utils/validators'
import { CREDENTIALS_CONTEXT_V1_URL } from '../../constants'
import { getCredentialContextVersion, type W3cCredentialDataModelVersion } from '../../credentialContextVersion'
import { IsCredentialJsonLdContext, IsCredentialType, IsW3cCredentialDate } from '../../validators'
import { W3cCredentialSchema } from './W3cCredentialSchema'
import { W3cCredentialStatus } from './W3cCredentialStatus'
import type { W3cCredentialSubjectOptions } from './W3cCredentialSubject'
import { IsW3cCredentialSubject, W3cCredentialSubject, W3cCredentialSubjectTransformer } from './W3cCredentialSubject'
import type { W3cIssuerOptions } from './W3cIssuer'
import { IsW3cIssuer, W3cIssuer, W3cIssuerTransformer } from './W3cIssuer'

export interface W3cCredentialOptions {
  context?: Array<string | JsonObject>
  id?: string
  type: Array<string>
  issuer: string | W3cIssuerOptions

  /**
   * Data model 1.1 only. Required when the credential uses the data model 1.1 context.
   */
  issuanceDate?: string

  /**
   * Data model 1.1 only.
   */
  expirationDate?: string

  /**
   * Data model 2.0 only. Replaces {@link issuanceDate}.
   */
  validFrom?: string

  /**
   * Data model 2.0 only. Replaces {@link expirationDate}.
   */
  validUntil?: string

  credentialSubject: SingleOrArray<W3cCredentialSubjectOptions>
  credentialStatus?: W3cCredentialStatus
  credentialSchema?: SingleOrArray<W3cCredentialSchema>
}

export class W3cCredential {
  public constructor(options: W3cCredentialOptions) {
    if (options) {
      this.context = options.context ?? [CREDENTIALS_CONTEXT_V1_URL]
      // Assigning an undefined id would serialize an `id` key without a value, which is invalid JSON-LD
      if (options.id !== undefined) this.id = options.id
      this.type = options.type || ['VerifiableCredential']
      this.issuer =
        typeof options.issuer === 'string' || options.issuer instanceof W3cIssuer
          ? options.issuer
          : new W3cIssuer(options.issuer)
      // Only assign the dates that apply to the data model version in use, so credentials do not
      // serialize terms that are not defined by their context.
      if (options.issuanceDate !== undefined) this.issuanceDate = options.issuanceDate
      if (options.expirationDate !== undefined) this.expirationDate = options.expirationDate
      if (options.validFrom !== undefined) this.validFrom = options.validFrom
      if (options.validUntil !== undefined) this.validUntil = options.validUntil
      this.credentialSubject = mapSingleOrArray(options.credentialSubject, (subject) =>
        subject instanceof W3cCredentialSubject ? subject : new W3cCredentialSubject(subject)
      )

      if (options.credentialStatus) {
        this.credentialStatus =
          options.credentialStatus instanceof W3cCredentialStatus
            ? options.credentialStatus
            : new W3cCredentialStatus(options.credentialStatus)
      }

      if (options.credentialSchema) {
        this.credentialSchema = mapSingleOrArray(options.credentialSchema, (schema) =>
          schema instanceof W3cCredentialSchema ? schema : new W3cCredentialSchema(schema)
        )
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

  @IsW3cCredentialDate({ dataModelVersion: '1.1', required: true })
  public issuanceDate?: string

  @IsW3cCredentialDate({ dataModelVersion: '1.1' })
  public expirationDate?: string

  @IsW3cCredentialDate({ dataModelVersion: '2.0' })
  public validFrom?: string

  @IsW3cCredentialDate({ dataModelVersion: '2.0' })
  public validUntil?: string

  @IsW3cCredentialSubject({ each: true })
  @W3cCredentialSubjectTransformer()
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

  /**
   * The Verifiable Credentials Data Model version this credential expresses, derived from the
   * base JSON-LD context.
   */
  public get dataModelVersion(): W3cCredentialDataModelVersion | undefined {
    return getCredentialContextVersion(this.context)
  }

  /**
   * The date from which the credential is valid, regardless of the data model version.
   * Maps to `issuanceDate` in data model 1.1 and to `validFrom` in data model 2.0.
   */
  public get validFromDate(): string | undefined {
    return this.dataModelVersion === '2.0' ? this.validFrom : this.issuanceDate
  }

  /**
   * The date after which the credential is no longer valid, regardless of the data model version.
   * Maps to `expirationDate` in data model 1.1 and to `validUntil` in data model 2.0.
   */
  public get validUntilDate(): string | undefined {
    return this.dataModelVersion === '2.0' ? this.validUntil : this.expirationDate
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
