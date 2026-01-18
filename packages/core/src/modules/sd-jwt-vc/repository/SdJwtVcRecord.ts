import { decodeSdJwtSync } from '@sd-jwt/decode'
import { Hasher } from '../../../crypto'
import type { TagsBase } from '../../../storage/BaseRecord'
import { BaseRecord } from '../../../storage/BaseRecord'
import type { NonEmptyArray } from '../../../types'
import { JsonTransformer } from '../../../utils'
import { CredentialMultiInstanceState } from '../../../utils/credentialUseTypes'
import type { Constructable } from '../../../utils/mixins'
import { uuid } from '../../../utils/uuid'
import type { KnownJwaSignatureAlgorithm } from '../../kms'
import { decodeSdJwtVc } from '../decodeSdJwtVc'
import type { SdJwtVc } from '../SdJwtVcService'
import type { SdJwtVcTypeMetadata } from '../typeMetadata'

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

  /**
   * @since 0.6 - tag was not defined before 0.6
   */
  multiInstanceState?: CredentialMultiInstanceState
}

export type SdJwtVcRecordStorageProps = {
  id?: string
  createdAt?: Date
  tags?: TagsBase

  /**
   * The SD-JWT VC instances to store on the record.
   *
   * NOTE that all instances should contain roughly the same data (e.g. exp can differ slighty), as they should be usable
   * interchangeably for presentations (allowing single-use credentials and batch issuance).
   */
  credentialInstances: SdJwtVcRecordInstances

  /**
   * Optional VCT type metadata associated with the SD JWT VC instances, this type metadata is used for
   * all SD JWT VC instances on this record.
   *
   * The type metadata is the result of resolving and merging the vct value and all `extends` values.
   *
   * NOTE: This may only include the latest VCT document, if the credential was stored before resolving
   * `extends` claims was supported.
   */
  typeMetadata?: SdJwtVcTypeMetadata

  /**
   * The original chain of SD-JWT VC Type Metadata documents, ordered from the extending type to the last extended type.
   * This is stored on the record to allow extensions to the type metadata (e.g. EUDI ARF TS12 for payments) to apply a
   * custom merging strategy.
   */
  typeMetadataChain?: NonEmptyArray<SdJwtVcTypeMetadata>
}

export type SdJwtVcRecordInstances = NonEmptyArray<{
  compactSdJwtVc: string

  /**
   * The kms key id to which the credential is bound. If not defined it either:
   * - uses a legacy key id (which can be calculated based on the key)
   * - is bound to a did (which stores the kms key id on the did record)
   */
  kmsKeyId?: string
}>

export class SdJwtVcRecord extends BaseRecord<DefaultSdJwtVcRecordTags> {
  public static readonly type = 'SdJwtVcRecord'
  public readonly type = SdJwtVcRecord.type

  public credentialInstances!: SdJwtVcRecordInstances

  /**
   * Tracks the state of credential instances on this record.
   *
   * NOTE: This defaults to `CredentialMultiInstanceState.SingleInstanceUsed` for records that
   * don't have a value set from before 0.6. We assume the credential has already been used.
   */
  public multiInstanceState = CredentialMultiInstanceState.SingleInstanceUsed

  /**
   * Only here for class transformation. If compactSdJwtVc is set we transform
   * it to the new sdJwtVcs array format
   */
  private set compactSdJwtVc(compactSdJwtVc: string) {
    this.credentialInstances = [
      {
        compactSdJwtVc,
      },
    ]
  }

  public typeMetadata?: SdJwtVcTypeMetadata

  /**
   * The original chain of SD-JWT VC Type Metadata documents, ordered from the extending type to the last extended type.
   * This is stored on the record to allow extensions to the type metadata (e.g. EUDI ARF TS12 for payments) to apply a
   * custom merging strategy.
   */
  public typeMetadataChain?: NonEmptyArray<SdJwtVcTypeMetadata>

  public constructor(props: SdJwtVcRecordStorageProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()

      this.credentialInstances = props.credentialInstances

      // Set multiInstanceState based on the number of initial instances. We
      // assume the instance is unused when the record is created.
      this.multiInstanceState =
        this.credentialInstances.length === 1
          ? CredentialMultiInstanceState.SingleInstanceUnused
          : CredentialMultiInstanceState.MultiInstanceFirstUnused

      this.typeMetadata = props.typeMetadata
      this.typeMetadataChain = props.typeMetadataChain
      this._tags = props.tags ?? {}
    }
  }

  public get firstCredential(): SdJwtVc {
    return {
      ...decodeSdJwtVc(this.credentialInstances[0].compactSdJwtVc, this.typeMetadata),
      kmsKeyId: this.credentialInstances[0].kmsKeyId,
    }
  }

  public static fromSdJwtVc(sdJwtVc: SdJwtVc) {
    return new SdJwtVcRecord({
      credentialInstances: [
        {
          compactSdJwtVc: sdJwtVc.compact,
          kmsKeyId: sdJwtVc.kmsKeyId,
        },
      ],
      typeMetadata: sdJwtVc.typeMetadata,
    })
  }

  public get extendedVctValues() {
    return this.typeMetadataChain
      ? // Remove the first one, as that's not extended
        this.typeMetadataChain
          .slice(1)
          .map(({ vct }) => vct)
      : this.typeMetadata?.extends
        ? [this.typeMetadata.extends]
        : []
  }

  public getTags() {
    const sdjwt = decodeSdJwtSync(this.credentialInstances[0].compactSdJwtVc, Hasher.hash)
    const vct = sdjwt.jwt.payload.vct as string
    const sdAlg = sdjwt.jwt.payload._sd_alg as string | undefined
    const alg = sdjwt.jwt.header.alg as KnownJwaSignatureAlgorithm

    return {
      ...this._tags,
      vct,
      extendedVctValues: this.extendedVctValues,
      sdAlg: sdAlg ?? 'sha-256',
      alg,
      multiInstanceState: this.multiInstanceState,
    }
  }

  public clone(): this {
    return JsonTransformer.fromJSON(JsonTransformer.toJSON(this), this.constructor as Constructable<this>)
  }

  /**
   * encoded is convenience method added to all credential records
   */
  public get encoded(): string {
    return this.credentialInstances[0].compactSdJwtVc
  }
}
