import { BaseRecord, type Tags } from '../../../storage/BaseRecord'
import type { NonEmptyArray } from '../../../types'
import { JsonTransformer } from '../../../utils'
import type { Constructable } from '../../../utils/mixins'
import { uuid } from '../../../utils/uuid'
import { W3cJsonLdVerifiableCredential } from '../data-integrity'
import { W3cJwtVerifiableCredential } from '../jwt-vc'
import { ClaimFormat, type W3cVerifiableCredential } from '../models'
import type { W3cJsonCredential } from '../models/credential/W3cJsonCredential'

export interface W3cCredentialRecordOptions {
  id?: string
  createdAt?: Date
  tags?: CustomW3cCredentialTags

  /**
   * The W3C credential instances to store on the record.
   *
   * NOTE that all instances should contain roughly the same data (e.g. exp can differ slighty), as they should be usable
   * interchangeably for presentations (allowing single-use credentials and batch issuance).
   */
  credentialInstances: W3cCredentialRecordInstances
}

export type W3cCredentialRecordInstances = NonEmptyArray<{
  credential: string | W3cJsonCredential

  // no kmsKeyId for w3c credential record, since all credentials are bound to a DID
}>

export type CustomW3cCredentialTags = {
  /**
   * Expanded types are used for JSON-LD credentials to allow for filtering on the expanded type.
   */
  expandedTypes?: Array<string>
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
  types: Array<string>
  algs?: Array<string>
}

export class W3cCredentialRecord extends BaseRecord<DefaultW3cCredentialTags, CustomW3cCredentialTags> {
  public static readonly type = 'W3cCredentialRecord'
  public readonly type = W3cCredentialRecord.type

  public credentialInstances!: W3cCredentialRecordInstances
  public readonly isMultiInstanceRecord!: boolean

  public constructor(props: W3cCredentialRecordOptions) {
    super()
    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this._tags = props.tags ?? {}
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
  private set credential(credential: W3cVerifiableCredential) {
    this.credentialInstances = [
      {
        // NOTE: we have to type the `set` method the same as the `get`. Previously
        // we had a transformer that would transform. Now the set is private and will
        // only be called by class transformer, and is the raw type.
        credential: credential as unknown as string | W3cJsonCredential,
      },
    ]
  }

  public get firstCredential(): W3cVerifiableCredential {
    const credential = this.credentialInstances[0].credential
    return typeof credential === 'string'
      ? W3cJwtVerifiableCredential.fromSerializedJwt(credential)
      : W3cJsonLdVerifiableCredential.fromJson(credential)
  }

  public static fromCredential(credential: W3cVerifiableCredential) {
    return new W3cCredentialRecord({
      credentialInstances: [
        {
          credential: credential.encoded as string | W3cJsonCredential,
        },
      ],
      tags: {},
    })
  }

  public getTags(): Tags<DefaultW3cCredentialTags, CustomW3cCredentialTags> {
    const credential = this.firstCredential
    // Contexts are usually strings, but can sometimes be objects. We're unable to use objects as tags,
    // so we filter out the objects before setting the tags.
    const stringContexts = credential.contexts.filter((ctx): ctx is string => typeof ctx === 'string')

    const tags: Tags<DefaultW3cCredentialTags, CustomW3cCredentialTags> = {
      ...this._tags,
      issuerId: credential.issuerId,
      subjectIds: credential.credentialSubjectIds,
      schemaIds: credential.credentialSchemaIds,
      contexts: stringContexts,
      givenId: credential.id,
      claimFormat: credential.claimFormat,
      types: credential.type,
    }

    // Proof types is used for ldp_vc credentials
    if (credential.claimFormat === ClaimFormat.LdpVc) {
      tags.proofTypes = credential.proofTypes
      tags.cryptosuites = credential.dataIntegrityCryptosuites
    }

    // Algs is used for jwt_vc credentials
    else if (credential.claimFormat === ClaimFormat.JwtVc) {
      tags.algs = [credential.jwt.header.alg]
    }

    return tags
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

  /**
   * encoded is convenience method added to all credential records
   */
  public get encoded() {
    return this.credentialInstances[0].credential
  }
}
