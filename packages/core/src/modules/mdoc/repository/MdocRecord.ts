import type { TagsBase } from '../../../storage/BaseRecord'
import type { Constructable } from '../../../utils/mixins'

import { BaseRecord } from '../../../storage/BaseRecord'
import { NonEmptyArray } from '../../../types'
import { JsonTransformer } from '../../../utils'
import { uuid } from '../../../utils/uuid'
import { KnownJwaSignatureAlgorithm } from '../../kms'
import { Mdoc } from '../Mdoc'

export type DefaultMdocRecordTags = {
  docType: string

  /**
   *
   * The Jwa Signature Algorithm used to sign the Mdoc.
   */
  alg: KnownJwaSignatureAlgorithm
}

export type MdocRecordStorageProps = {
  id?: string
  createdAt?: Date
  tags?: TagsBase

  /**
   * The mDOC instances to store on the record.
   *
   * NOTE that all instances should contain roughly the same data (e.g. exp can differ slighty), as they should be usable
   * interchangeably for presentations (allowing single-use credentials and batch issuance).
   */
  credentialInstances: MdocRecordInstances
}

export type MdocRecordInstances = NonEmptyArray<{
  issuerSignedBase64Url: string

  /**
   * The kms key id to which the credential is bound. If not defined the
   * credential is bound to a legacy key id (which can be calculated based on the key)
   */
  kmsKeyId?: string
}>

export class MdocRecord extends BaseRecord<DefaultMdocRecordTags> {
  public static readonly type = 'MdocRecord'
  public readonly type = MdocRecord.type

  public credentialInstances!: MdocRecordInstances
  public readonly isMultiInstanceRecord!: boolean

  /**
   * Only here for class transformation. If base64Url is set we transform
   * it to the new mdocs array format
   */
  private set base64Url(base64Url: string) {
    this.credentialInstances = [
      {
        issuerSignedBase64Url: base64Url,
      },
    ]
  }

  public constructor(props: MdocRecordStorageProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.credentialInstances = props.credentialInstances
      // We set this as a property since we can get down to 1 credential
      // and in this case we still need to know whether this was a multi instance
      // record when it was created.
      this.isMultiInstanceRecord = this.credentialInstances.length > 1
      this._tags = props.tags ?? {}
    }
  }

  public get firstMdoc(): Mdoc {
    const mdoc = Mdoc.fromBase64Url(this.credentialInstances[0].issuerSignedBase64Url)

    mdoc.deviceKeyId = this.credentialInstances[0].kmsKeyId ?? mdoc.deviceKey?.legacyKeyId

    return mdoc
  }

  public static fromMdoc(mdoc: Mdoc) {
    return new MdocRecord({
      credentialInstances: [
        {
          issuerSignedBase64Url: mdoc.base64Url,
          kmsKeyId: mdoc.deviceKeyId,
        },
      ],
    })
  }

  public getTags() {
    const mdoc = this.firstMdoc
    const docType = mdoc.docType
    const alg = mdoc.alg

    return {
      ...this._tags,
      docType,
      alg,
    }
  }

  public clone(): this {
    return JsonTransformer.fromJSON(JsonTransformer.toJSON(this), this.constructor as Constructable<this>)
  }

  /**
   * credential is convenience method added to all credential records
   */
  public get credential(): Mdoc {
    return this.firstMdoc
  }

  /**
   * encoded is convenience method added to all credential records
   */
  public get encoded(): string {
    return this.credentialInstances[0].issuerSignedBase64Url
  }
}
