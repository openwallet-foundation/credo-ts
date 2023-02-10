import type { TagsBase } from '@aries-framework/core'

import { BaseRecord, utils } from '@aries-framework/core'

export interface AnonCredsLinkSecretRecordProps {
  id?: string
  linkSecretId: string
  value?: string // If value is not provided, only reference to link secret is stored in regular storage
}

export type DefaultAnonCredsLinkSecretTags = {
  linkSecretId: string
}

export type CustomAnonCredsLinkSecretTags = TagsBase & {
  isDefault?: boolean
}

export class AnonCredsLinkSecretRecord extends BaseRecord<DefaultAnonCredsLinkSecretTags, TagsBase> {
  public static readonly type = 'AnonCredsLinkSecretRecord'
  public readonly type = AnonCredsLinkSecretRecord.type

  public readonly linkSecretId!: string
  public readonly value?: string

  public constructor(props: AnonCredsLinkSecretRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
      this.linkSecretId = props.linkSecretId
      this.value = props.value
    }
  }

  public getTags() {
    return {
      ...this._tags,
      linkSecretId: this.linkSecretId,
    }
  }
}
