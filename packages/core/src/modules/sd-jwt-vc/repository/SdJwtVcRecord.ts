import type { TagsBase } from '../../../storage/BaseRecord'
import type { Constructable } from '../../../utils/mixins'
import type { SdJwtVc } from '../SdJwtVcService'
import type { SdJwtVcTypeMetadata } from '../typeMetadata'

import { decodeSdJwtSync } from '@sd-jwt/decode'

import { Hasher } from '../../../crypto'
import { BaseRecord } from '../../../storage/BaseRecord'
import { JsonTransformer } from '../../../utils'
import { uuid } from '../../../utils/uuid'
import { KnownJwaSignatureAlgorithm } from '../../kms'
import { decodeSdJwtVc } from '../decodeSdJwtVc'
import { NonEmptyArray } from '../../../types'

export type DefaultSdJwtVcRecordTags = {
  vct: string

  /**
   * The sdAlg is the alg used for creating digests for selective disclosures
   */
  sdAlg: string

  /**
   * The alg is the alg used to sign the SD-JWT
   */
  alg: KnownJwaSignatureAlgorithm
}

export type SdJwtVcRecordStorageProps = {
  id?: string
  createdAt?: Date
  tags?: TagsBase
  sdJwtVcs: SdJwtVcRecordInstances

  typeMetadata?: SdJwtVcTypeMetadata
}

export type SdJwtVcRecordInstances = NonEmptyArray<{
  compactSdJwtVc: string

  /**
   * The kms key id to which the credential is bound. If not defined it either:
   * - uses a legacy key id (which can be calculated based on the key id)
   * - or is bound to a did (which stores the kms key id on the did record)
   */
  kmsKeyId?: string
}>

export class SdJwtVcRecord extends BaseRecord<DefaultSdJwtVcRecordTags> {
  public static readonly type = 'SdJwtVcRecord'
  public readonly type = SdJwtVcRecord.type

  public sdJwtVcs!: SdJwtVcRecordInstances

  /**
   * Only here for class transformation. If compactSdJwtVc is set we transform
   * it to the new sdJwtVcs array format
   */
  private set compactSdJwtVc(compactSdJwtVc: string) {
    this.sdJwtVcs = [
      {
        compactSdJwtVc,
      },
    ]
  }

  public typeMetadata?: SdJwtVcTypeMetadata

  public constructor(props: SdJwtVcRecordStorageProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.sdJwtVcs = props.sdJwtVcs
      this.typeMetadata = props.typeMetadata
      this._tags = props.tags ?? {}
    }
  }

  public get firstSdJwtVc(): SdJwtVc {
    return {
      ...decodeSdJwtVc(this.sdJwtVcs[0].compactSdJwtVc, this.typeMetadata),
      kmsKeyId: this.sdJwtVcs[0].kmsKeyId,
    }
  }

  public getTags() {
    const sdjwt = decodeSdJwtSync(this.sdJwtVcs[0].compactSdJwtVc, Hasher.hash)
    const vct = sdjwt.jwt.payload.vct as string
    const sdAlg = sdjwt.jwt.payload._sd_alg as string | undefined
    const alg = sdjwt.jwt.header.alg as KnownJwaSignatureAlgorithm

    return {
      ...this._tags,
      vct,
      sdAlg: sdAlg ?? 'sha-256',
      alg,
    }
  }

  public clone(): this {
    return JsonTransformer.fromJSON(JsonTransformer.toJSON(this), this.constructor as Constructable<this>)
  }

  /**
   * credential is convenience method added to all credential records
   */
  public get credential(): SdJwtVc {
    return this.firstSdJwtVc
  }

  /**
   * encoded is convenience method added to all credential records
   */
  public get encoded(): string {
    return this.sdJwtVcs[0].compactSdJwtVc
  }
}
