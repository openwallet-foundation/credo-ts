import { BaseRecord, type Tags, type TagsBase } from '../../../storage/BaseRecord'
import { asArray, JsonTransformer } from '../../../utils'
import type { Constructable } from '../../../utils/mixins'
import { uuid } from '../../../utils/uuid'
import { ClaimFormat, W3cV2EnvelopedVerifiableCredential, type W3cV2VerifiableCredential } from '../models'
import { W3cV2VerifiableCredentialTransformer } from '../models/credential/W3cV2VerifiableCredential'

export interface W3cV2CredentialRecordOptions {
  id?: string
  createdAt?: Date
  credential: W3cV2VerifiableCredential
}

export type DefaultW3cV2CredentialTags = {
  issuerId: string
  subjectIds: Array<string>
  schemaIds: Array<string>
  contexts: Array<string>
  givenId?: string
  claimFormat: W3cV2VerifiableCredential['claimFormat']

  types: Array<string>
  algs?: Array<string>
}

export class W3cV2CredentialRecord extends BaseRecord<DefaultW3cV2CredentialTags> {
  public static readonly type = 'W3cV2CredentialRecord'
  public readonly type = W3cV2CredentialRecord.type

  @W3cV2VerifiableCredentialTransformer()
  public credential!: W3cV2VerifiableCredential

  public constructor(props: W3cV2CredentialRecordOptions) {
    super()
    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.credential = props.credential
    }
  }

  public getTags(): Tags<DefaultW3cV2CredentialTags, TagsBase> {
    const resolvedCredential = this.credential.resolvedCredential

    // Contexts are usually strings, but can sometimes be objects. We're unable to use objects as tags,
    // so we filter out the objects before setting the tags.
    const stringContexts = resolvedCredential.contexts.filter((ctx): ctx is string => typeof ctx === 'string')

    const tags: Tags<DefaultW3cV2CredentialTags, TagsBase> = {
      ...this._tags,
      issuerId: resolvedCredential.issuerId,
      subjectIds: resolvedCredential.credentialSubjectIds,
      schemaIds: resolvedCredential.credentialSchemaIds,
      contexts: stringContexts,
      givenId: resolvedCredential.id,
      claimFormat: this.credential.claimFormat,
      types: asArray(resolvedCredential.type),
    }

    if (this.credential instanceof W3cV2EnvelopedVerifiableCredential) {
      const enveloped = this.credential.envelopedCredential
      if (enveloped.claimFormat === ClaimFormat.JwtW3cVc) {
        tags.algs = [enveloped.jwt.header.alg]
      } else if (enveloped.claimFormat === ClaimFormat.SdJwtW3cVc) {
        tags.algs = [enveloped.sdJwt.header.alg]
      }
    }

    return tags
  }

  /**
   * This overwrites the default `clone` method for records, as the W3cV3CredentialRecord
   * has issues with the default clone method due to the way the JWT and SD-JWT
   * records are implemented. This is a temporary way to make sure the clone still works, but ideally
   * we find an alternative.
   */
  public clone(): this {
    return JsonTransformer.fromJSON(JsonTransformer.toJSON(this), this.constructor as Constructable<this>)
  }

  /**
   * encoded is convenience method added to all credential records
   */
  public get encoded() {
    return this.credential.encoded
  }
}
