import type { TagsBase } from '@credo-ts/core'

import { BaseRecord, createRecordEncodingSchema, utils } from '@credo-ts/core'
import { z } from 'zod'

export interface AnonCredsLinkSecretRecordProps {
  id?: string
  linkSecretId: string
  value?: string // If value is not provided, only reference to link secret is stored in regular storage
}

export type DefaultAnonCredsLinkSecretTags = {
  linkSecretId: string
}

// TODO: isDefault should not be a tag, but a field in the record
export type CustomAnonCredsLinkSecretTags = TagsBase & {
  isDefault?: boolean
}

const anonCredsLinkSecretRecordEncodingSchema = createRecordEncodingSchema({
  linkSecretId: z.string().optional(),
  value: z.string().optional(),
})

export class AnonCredsLinkSecretRecord extends BaseRecord<
  DefaultAnonCredsLinkSecretTags,
  CustomAnonCredsLinkSecretTags
> {
  public static get encodingSchema(): z.ZodType {
    return anonCredsLinkSecretRecordEncodingSchema
  }

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
