import type { AnonCredsClaimRecord } from './anonCredsCredentialValue'
import type { Tags, TagsBase } from '../../../storage/BaseRecord'
import type { Constructable } from '../../../utils/mixins'

import { Type } from 'class-transformer'
import { IsOptional } from 'class-validator'

import { AriesFrameworkError } from '../../../error'
import { BaseRecord } from '../../../storage/BaseRecord'
import { JsonTransformer } from '../../../utils'
import { uuid } from '../../../utils/uuid'
import { ClaimFormat, W3cVerifiableCredential, W3cVerifiableCredentialTransformer } from '../models'

import { W3cAnonCredsCredentialMetadata } from './W3CAnoncredsCredentialMetadata'
import { mapAttributeRawValuesToAnonCredsCredentialValues } from './anonCredsCredentialValue'

export interface AnonCredsCredentialRecordOptions {
  credentialId: string
  credentialRevocationId?: string
  linkSecretId: string
  schemaName: string
  schemaVersion: string
  schemaIssuerId: string
  methodName: string
  // TODO: derive from proof
  schemaId: string
  credentialDefinitionId: string
  revocationRegistryId?: string

  unqualifiedTags?: {
    issuerId: string
    schemaId: string
    schemaIssuerId: string
    credentialDefinitionId: string
    revocationRegistryId?: string
  }
}

export interface W3cCredentialRecordOptions {
  id?: string
  createdAt?: Date
  credential: W3cVerifiableCredential
  tags: CustomW3cCredentialTags
  anonCredsCredentialRecordOptions?: AnonCredsCredentialRecordOptions
}

export type DefaultW3cCredentialTags = {
  issuerId: string
  subjectIds: Array<string>
  schemaIds: Array<string>
  contexts: Array<string>
  givenId?: string

  // Can be any of the values for claimFormat
  claimFormat: W3cVerifiableCredential['claimFormat']

  proofTypes?: Array<string>
  cryptosuites?: Array<string>
  algs?: Array<string>
}

export type DefaultAnonCredsCredentialTags = {
  credentialId: string
  linkSecretId: string
  credentialRevocationId?: string
  methodName: string

  // the following keys can be used for every `attribute name` in credential.
  [key: `attr::${string}::marker`]: true | undefined
  [key: `attr::${string}::value`]: string | undefined
}

export type CustomW3cCredentialTags = TagsBase & {
  /**
   * Expanded types are used for JSON-LD credentials to allow for filtering on the expanded type.
   */
  expandedTypes?: Array<string>
}

export type CustomAnonCredsCredentialTags = {
  schemaName: string
  schemaVersion: string

  // TODO: derive from proof
  schemaId: string
  schemaIssuerId: string
  credentialDefinitionId: string
  revocationRegistryId?: string

  unqualifiedIssuerId: string | undefined
  unqualifiedSchemaId: string | undefined
  unqualifiedSchemaIssuerId: string | undefined
  unqualifiedCredentialDefinitionId: string | undefined
  unqualifiedRevocationRegistryId: string | undefined
}

export class W3cCredentialRecord extends BaseRecord<
  DefaultW3cCredentialTags & Partial<DefaultAnonCredsCredentialTags>,
  CustomW3cCredentialTags & Partial<CustomAnonCredsCredentialTags>
> {
  public static readonly type = 'W3cCredentialRecord'
  public readonly type = W3cCredentialRecord.type

  @W3cVerifiableCredentialTransformer()
  public credential!: W3cVerifiableCredential

  @IsOptional()
  @Type(() => W3cAnonCredsCredentialMetadata)
  public readonly anonCredsCredentialMetadata?: W3cAnonCredsCredentialMetadata

  public constructor(props: W3cCredentialRecordOptions) {
    super()
    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.credential = props.credential

      if (props.anonCredsCredentialRecordOptions) {
        this.anonCredsCredentialMetadata = new W3cAnonCredsCredentialMetadata({
          credentialId: props.anonCredsCredentialRecordOptions.credentialId,
          credentialRevocationId: props.anonCredsCredentialRecordOptions.credentialRevocationId,
          linkSecretId: props.anonCredsCredentialRecordOptions.linkSecretId,
          methodName: props.anonCredsCredentialRecordOptions.methodName,
        })
      }

      this.setTags({
        ...props.tags,
        schemaIssuerId: props.anonCredsCredentialRecordOptions?.schemaIssuerId,
        schemaName: props.anonCredsCredentialRecordOptions?.schemaName,
        schemaVersion: props.anonCredsCredentialRecordOptions?.schemaVersion,
        schemaId: props.anonCredsCredentialRecordOptions?.schemaId,
        credentialDefinitionId: props.anonCredsCredentialRecordOptions?.credentialDefinitionId,
        revocationRegistryId: props.anonCredsCredentialRecordOptions?.revocationRegistryId,
        unqualifiedIssuerId: props.anonCredsCredentialRecordOptions?.unqualifiedTags?.issuerId,
        unqualifiedSchemaIssuerId: props.anonCredsCredentialRecordOptions?.unqualifiedTags?.schemaIssuerId,
        unqualifiedSchemaId: props.anonCredsCredentialRecordOptions?.unqualifiedTags?.schemaId,
        unqualifiedCredentialDefinitionId:
          props.anonCredsCredentialRecordOptions?.unqualifiedTags?.credentialDefinitionId,
        unqualifiedRevocationRegistryId: props.anonCredsCredentialRecordOptions?.unqualifiedTags?.revocationRegistryId,
      })
    }
  }

  public getTags() {
    // Contexts are usually strings, but can sometimes be objects. We're unable to use objects as tags,
    // so we filter out the objects before setting the tags.
    const stringContexts = this.credential.contexts.filter((ctx): ctx is string => typeof ctx === 'string')

    const tags: DefaultW3cCredentialTags = {
      ...this._tags,
      issuerId: this.credential.issuerId,
      subjectIds: this.credential.credentialSubjectIds,
      schemaIds: this.credential.credentialSchemaIds,
      contexts: stringContexts,
      givenId: this.credential.id,
      claimFormat: this.credential.claimFormat,
    }

    // Proof types is used for ldp_vc credentials
    if (this.credential.claimFormat === ClaimFormat.LdpVc) {
      tags.proofTypes = this.credential.proofTypes
      tags.cryptosuites = this.credential.cryptoSuites
    }

    // Algs is used for jwt_vc credentials
    else if (this.credential.claimFormat === ClaimFormat.JwtVc) {
      tags.algs = [this.credential.jwt.header.alg]
    }

    return {
      ...tags,
      ...this.getAnonCredsTags(),
    }
  }

  public getAnonCredsTags(): Tags<DefaultAnonCredsCredentialTags, CustomAnonCredsCredentialTags> | undefined {
    if (!this.anonCredsCredentialMetadata) return undefined

    const { schemaId, schemaName, schemaVersion, schemaIssuerId, credentialDefinitionId } = this._tags
    if (!schemaId || !schemaName || !schemaVersion || !schemaIssuerId || !credentialDefinitionId) return undefined
    const {
      unqualifiedSchemaId,
      unqualifiedSchemaIssuerId,
      unqualifiedCredentialDefinitionId,
      unqualifiedRevocationRegistryId,
      unqualifiedIssuerId,
    } = this._tags

    const anonCredsCredentialTags: Tags<DefaultAnonCredsCredentialTags, CustomAnonCredsCredentialTags> = {
      schemaId,
      schemaIssuerId,
      schemaName,
      schemaVersion,
      credentialDefinitionId,
      revocationRegistryId: this._tags.revocationRegistryId,
      unqualifiedIssuerId,
      unqualifiedSchemaId,
      unqualifiedSchemaIssuerId,
      unqualifiedCredentialDefinitionId,
      unqualifiedRevocationRegistryId,
      credentialId: this.anonCredsCredentialMetadata?.credentialId as string,
      credentialRevocationId: this.anonCredsCredentialMetadata?.credentialRevocationId as string,
      linkSecretId: this.anonCredsCredentialMetadata?.linkSecretId as string,
      methodName: this.anonCredsCredentialMetadata?.methodName as string,
    }

    if (Array.isArray(this.credential.credentialSubject)) {
      throw new AriesFrameworkError('Credential subject must be an object, not an array.')
    }

    const values = mapAttributeRawValuesToAnonCredsCredentialValues(
      (this.credential.credentialSubject.claims as AnonCredsClaimRecord) ?? {}
    )

    for (const [key, value] of Object.entries(values)) {
      anonCredsCredentialTags[`attr::${key}::value`] = value.raw
      anonCredsCredentialTags[`attr::${key}::marker`] = true
    }

    return anonCredsCredentialTags
  }

  /**
   * This overwrites the default clone method for records
   * as the W3cRecord has issues with the default clone method
   * due to how W3cJwtVerifiableCredential is implemented. This is
   * a temporary way to make sure the clone still works, but ideally
   * we find an alternative.
   */
  public clone(): this {
    return JsonTransformer.fromJSON(JsonTransformer.toJSON(this), this.constructor as Constructable<this>)
  }
}
