import type { JwaSignatureAlgorithm } from '../../../crypto'
import type { TagsBase } from '../../../storage/BaseRecord'
import type { Constructable } from '../../../utils/mixins'

import { SdJwtVc } from '@sd-jwt/core'

import { BaseRecord } from '../../../storage/BaseRecord'
import { JsonTransformer } from '../../../utils'
import { uuid } from '../../../utils/uuid'

export type DefaultSdJwtVcRecordTags = {
  vct: string

  /**
   * The sdAlg is the alg used for creating digests for selective disclosures
   */
  sdAlg: string

  /**
   * The alg is the alg used to sign the SD-JWT
   */
  alg: JwaSignatureAlgorithm
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
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.compactSdJwtVc = props.compactSdJwtVc
      this._tags = props.tags ?? {}
    }
  }

  public getTags() {
    const sdJwtVc = SdJwtVc.fromCompact(this.compactSdJwtVc)

    return {
      ...this._tags,
      vct: sdJwtVc.getClaimInPayload<string>('vct'),
      sdAlg: (sdJwtVc.payload._sd_alg as string | undefined) ?? 'sha-256',
      alg: sdJwtVc.getClaimInHeader<JwaSignatureAlgorithm>('alg'),
    }
  }

  public clone(): this {
    return JsonTransformer.fromJSON(JsonTransformer.toJSON(this), this.constructor as Constructable<this>)
  }
}
