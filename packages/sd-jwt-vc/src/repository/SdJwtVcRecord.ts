import type { TagsBase, Constructable } from '@aries-framework/core'
import type { Disclosure } from '@sd-jwt/core'

import { JsonTransformer, BaseRecord, utils } from '@aries-framework/core'
import { SdJwtVc } from '@sd-jwt/core'

export type DefaultSdJwtVcRecordTags = {
  disclosureKeys?: Array<string>
}

export type SdJwtVcRecordStorageProps = {
  id?: string
  createdAt?: Date
  tags?: TagsBase
  compactSdJwtVc: string
}

export class SdJwtVcRecord extends BaseRecord<DefaultSdJwtVcRecordTags> {
  public static readonly type = 'SdJwtVcRecord'
  public readonly type = SdJwtVcRecord.type

  // We store the sdJwtVc in compact format.
  public compactSdJwtVc!: string

  // TODO: should we also store the pretty claims so it's not needed to
  // re-calculate the hashes each time? I think for now it's fine to re-calculate

  public constructor(props: SdJwtVcRecordStorageProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.compactSdJwtVc = props.compactSdJwtVc
      this._tags = props.tags ?? {}
    }
  }

  public getTags() {
    const disclosures = SdJwtVc.fromCompact(this.compactSdJwtVc).disclosures
    const disclosureKeys = disclosures
      ?.filter((d): d is Disclosure & { decoded: [string, string, unknown] } => d.decoded.length === 3)
      .map((d) => d.decoded[1])

    return {
      ...this._tags,
      disclosureKeys,
    }
  }

  public clone(): this {
    return JsonTransformer.fromJSON(JsonTransformer.toJSON(this), this.constructor as Constructable<this>)
  }
}
