import type { TagsBase } from '@aries-framework/core'
import type { DisclosureItem } from 'jwt-sd'

import { BaseRecord, utils } from '@aries-framework/core'

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
