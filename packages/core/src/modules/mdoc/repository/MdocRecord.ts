import type { TagsBase } from '../../../storage/BaseRecord'
import type { Constructable } from '../../../utils/mixins'

import { type JwaSignatureAlgorithm } from '../../../crypto'
import { BaseRecord } from '../../../storage/BaseRecord'
import { JsonTransformer } from '../../../utils'
import { uuid } from '../../../utils/uuid'
import { Mdoc } from '../Mdoc'

export type DefaultMdocRecordTags = {
  docType: string

  /**
   *
   * The alg is the alg used to sign the Mdoc
   */
  alg: JwaSignatureAlgorithm
}

export type MdocRecordStorageProps = {
  id?: string
  createdAt?: Date
  tags?: TagsBase
  mdoc: Mdoc
}

export class MdocRecord extends BaseRecord<DefaultMdocRecordTags> {
  public static readonly type = 'MdocRecord'
  public readonly type = MdocRecord.type

  // We store the mdoc in it's original format
  public issuerSignedHex!: string
  public docType!: string

  public constructor(props: MdocRecordStorageProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.issuerSignedHex = props.mdoc.issuerSignedHex
      this._tags = props.tags ?? {}
    }
  }

  public getTags() {
    const mdoc = Mdoc.fromIssuerSignedHex(this.issuerSignedHex)
    const alg = mdoc.jwaSignatureAlgorithm
    const docType = mdoc.docType

    return {
      ...this._tags,
      docType,
      alg,
    }
  }

  public clone(): this {
    return JsonTransformer.fromJSON(JsonTransformer.toJSON(this), this.constructor as Constructable<this>)
  }
}
