import { BaseRecord, type Tags, type TagsBase } from '../../../storage/BaseRecord'
import type { NonEmptyArray } from '../../../types'
import { asArray, JsonTransformer } from '../../../utils'
import type { Constructable } from '../../../utils/mixins'
import { uuid } from '../../../utils/uuid'
import { W3cV2JwtVerifiableCredential } from '../jwt-vc'
import { ClaimFormat, type W3cV2VerifiableCredential } from '../models'
import { W3cV2SdJwtVerifiableCredential } from '../sd-jwt-vc'

export interface W3cV2CredentialRecordOptions {
  id?: string
  createdAt?: Date

  credentialInstances: W3cV2CredentialRecordInstances
}

export type W3cV2CredentialRecordInstances = NonEmptyArray<{
  /**
   * NOTE: String for now, might change in the future if we add other types.
   */
  credential: string

  // no kmsKeyId for w3c credential record, since all credentials are bound to a DID
}>

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

  public credentialInstances!: W3cV2CredentialRecordInstances
  public readonly isMultiInstanceRecord!: boolean

  public constructor(props: W3cV2CredentialRecordOptions) {
    super()
    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.credentialInstances = props.credentialInstances
      // We set this as a property since we can get down to 1 credential
      // and in this case we still need to know whether this was a multi instance
      // record when it was created.
      this.isMultiInstanceRecord = this.credentialInstances.length > 1
    }
  }

  /**
   * Only here for class transformation. If credential is set we transform
   * it to the new credentialInstances array format
   */
  private set credential(credential: W3cV2VerifiableCredential) {
    this.credentialInstances = [
      {
        // NOTE: we have to type the `set` method the same as the `get`. Previously
        // we had a transformer that would transform. Now the set is private and will
        // only be called by class transformer, and is the raw type.
        credential: credential as unknown as string,
      },
    ]
  }

  public get firstCredential(): W3cV2VerifiableCredential {
    const credential = this.credentialInstances[0].credential
    return credential.includes('~')
      ? W3cV2SdJwtVerifiableCredential.fromCompact(credential)
      : W3cV2JwtVerifiableCredential.fromCompact(credential)
  }

  public static fromCredential(credential: W3cV2VerifiableCredential) {
    return new W3cV2CredentialRecord({
      credentialInstances: [
        {
          credential: credential.encoded as string,
        },
      ],
    })
  }

  public getTags(): Tags<DefaultW3cV2CredentialTags, TagsBase> {
    const credential = this.firstCredential
    const resolvedCredential = credential.resolvedCredential

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
      claimFormat: credential.claimFormat,
      types: asArray(resolvedCredential.type),
    }

    if (credential.claimFormat === ClaimFormat.JwtW3cVc) {
      tags.algs = [credential.jwt.header.alg]
    } else if (credential.claimFormat === ClaimFormat.SdJwtW3cVc) {
      tags.algs = [credential.sdJwt.header.alg]
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
    return this.credentialInstances[0].credential
  }
}
