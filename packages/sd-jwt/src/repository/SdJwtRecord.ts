import type { TagsBase, Constructable } from '@aries-framework/core'
import type { DisclosureItem, HasherAndAlgorithm } from 'jwt-sd'

import { JsonTransformer, Hasher, TypedArrayEncoder, BaseRecord, utils } from '@aries-framework/core'
import { Disclosure, HasherAlgorithm, SdJwtVc } from 'jwt-sd'

export type SdJwtRecordTags = TagsBase & {
  disclosureKeys?: Array<string>
}

export type SdJwt<
  Header extends Record<string, unknown> = Record<string, unknown>,
  Payload extends Record<string, unknown> = Record<string, unknown>
> = {
  disclosures?: Array<DisclosureItem>
  header: Header
  payload: Payload
  signature: Uint8Array

  holderDidUrl: string
}

export type SdJwtRecordStorageProps<
  Header extends Record<string, unknown> = Record<string, unknown>,
  Payload extends Record<string, unknown> = Record<string, unknown>
> = {
  id?: string
  createdAt?: Date
  tags?: SdJwtRecordTags
  sdJwt: SdJwt<Header, Payload>
}

export class SdJwtRecord<
  Header extends Record<string, unknown> = Record<string, unknown>,
  Payload extends Record<string, unknown> = Record<string, unknown>
> extends BaseRecord<SdJwtRecordTags> {
  public static readonly type = 'SdJwtRecord'
  public readonly type = SdJwtRecord.type

  public sdJwt!: SdJwt<Header, Payload>

  public constructor(props: SdJwtRecordStorageProps<Header, Payload>) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.sdJwt = props.sdJwt
      this._tags = props.tags ?? {}
    }
  }

  private get hasher(): HasherAndAlgorithm {
    return {
      algorithm: HasherAlgorithm.Sha256,
      hasher: (input: string) => {
        const serializedInput = TypedArrayEncoder.fromString(input)
        return Hasher.hash(serializedInput, 'sha2-256')
      },
    }
  }

  /**
   * This function gets the claims from the payload and combines them with the claims in the disclosures.
   *
   * This can be used to display all claims included in the `sd-jwt-vc` to the holder or verifier.
   */
  public async getPrettyClaims<Claims extends Record<string, unknown> | Payload = Payload>(): Promise<Claims> {
    const sdJwt = new SdJwtVc<Header, Payload>({
      header: this.sdJwt.header,
      payload: this.sdJwt.payload,
      disclosures: this.sdJwt.disclosures?.map(Disclosure.fromArray),
    }).withHasher(this.hasher)

    // Assert that we only support `sha-256` as a hashing algorithm
    if ('_sd_alg' in this.sdJwt.payload) {
      sdJwt.assertClaimInPayload('_sd_alg', HasherAlgorithm.Sha256.toString())
    }

    return await sdJwt.getPrettyClaims<Claims>()
  }

  public getTags() {
    const disclosureKeys = this.sdJwt.disclosures
      ?.filter((d): d is [string, string, unknown] => d.length === 3)
      .map((d) => d[1])

    return {
      ...this._tags,
      disclosureKeys,
    }
  }

  public clone(): this {
    return JsonTransformer.fromJSON(JsonTransformer.toJSON(this), this.constructor as Constructable<this>)
  }
}
