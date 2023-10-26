import type { TagsBase } from '@aries-framework/core'
import type { DisclosureItem, HasherAndAlgorithm } from 'jwt-sd'

import { Hasher, TypedArrayEncoder, BaseRecord, utils } from '@aries-framework/core'
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

  // TODO: include the holder key for key binding in here, for ease of use
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
        const hash = Hasher.hash(serializedInput, 'sha2-256')

        return TypedArrayEncoder.toBase64URL(hash)
      },
    }
  }

  public async getPrettyClaims<Claims extends Record<string, unknown> | Payload = Payload>(): Promise<Claims> {
    const sdJwt = new SdJwtVc<Header, Payload>({
      header: this.sdJwt.header,
      payload: this.sdJwt.payload,
      disclosures: this.sdJwt.disclosures?.map(Disclosure.fromArray),
    }).withHasher(this.hasher)

    // Assert that we only support `sha-256` as a hashing algorithm
    if ('_sd_alg' in this.sdJwt.payload) {
      sdJwt.assertClaimInPayload('sd_alg', HasherAlgorithm.Sha256.toString())
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
}
