import { z } from 'zod'
import { BaseRecord, type Tags } from '../../../storage/BaseRecord'
import { createRecordEncodingSchema } from '../../../storage/recordEncodingSchema'
import type { NonEmptyArray } from '../../../types'
import { CredentialMultiInstanceState } from '../../../utils/credentialUseTypes'
import { uuid } from '../../../utils/uuid'
import { zNonEmptyArray, zTypedObject } from '../../../utils/zod'
import { W3cJwtVerifiableCredential } from '../jwt-vc'
import { W3cJsonLdVerifiableCredential } from '../linked-data-proofs/models/W3cJsonLdVerifiableCredential'
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

  /**
   * @since 0.6 - tag was not defined before 0.6
   */
  multiInstanceState?: CredentialMultiInstanceState
}

const w3cCredentialRecordEncodingSchema = createRecordEncodingSchema(
  {
    credentialInstances: zNonEmptyArray(
      z.object({
        credential: z.union([z.string(), zTypedObject<W3cJsonCredential>()]),
      })
    ).optional(),
    multiInstanceState: z.string().optional(),
  },
  {
    // Records stored before 0.6 have a single credential instead of credentialInstances
    upgrade: ({ credential, ...encoded }) =>
      credential !== undefined ? { ...encoded, credentialInstances: [{ credential }] } : encoded,
  }
)

export class W3cCredentialRecord extends BaseRecord<DefaultW3cCredentialTags, CustomW3cCredentialTags> {
  public static get encodingSchema() {
    return w3cCredentialRecordEncodingSchema
  }

  public static readonly type = 'W3cCredentialRecord'
  public readonly type = W3cCredentialRecord.type

  public credentialInstances!: W3cCredentialRecordInstances

  /**
   * Tracks the state of credential instances on this record.
   *
   * NOTE: This defaults to `CredentialMultiInstanceState.SingleInstanceUsed` for records that
   * don't have a value set from before 0.6. We assume the credential has already been used.
   */
  public multiInstanceState = CredentialMultiInstanceState.SingleInstanceUsed

  public constructor(props: W3cCredentialRecordOptions) {
    super()
    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this._tags = props.tags ?? {}
      this.credentialInstances = props.credentialInstances

      // Set multiInstanceState based on the number of initial instances. We
      // assume the instance is unused when the record is created.
      this.multiInstanceState =
        this.credentialInstances.length === 1
          ? CredentialMultiInstanceState.SingleInstanceUnused
          : CredentialMultiInstanceState.MultiInstanceFirstUnused
    }
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
      multiInstanceState: this.multiInstanceState,
    }

    // Proof types is used for ldp_vc credentials
    if (credential.claimFormat === ClaimFormat.LdpVc) {
      tags.proofTypes = credential.proofTypes
      tags.cryptosuites = credential.anonCredsW3cCredentialCryptosuites
    }

    // Algs is used for jwt_vc credentials
    else if (credential.claimFormat === ClaimFormat.JwtVc) {
      tags.algs = [credential.jwt.header.alg]
    }

    return tags
  }

  /**
   * encoded is convenience method added to all credential records
   */
  public get encoded() {
    return this.credentialInstances[0].credential
  }
}
