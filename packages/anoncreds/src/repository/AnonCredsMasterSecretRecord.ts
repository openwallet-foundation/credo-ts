import type { TagsBase } from '@aries-framework/core'

import { BaseRecord, utils } from '@aries-framework/core'

export interface AnonCredsMasterSecretRecordProps {
  id?: string
  masterSecretId: string
  value?: string // If value is not provided, only reference to master secret is stored in regular storage
}

export type DefaultAnonCredsMasterSecretTags = {
  default?: boolean
  masterSecretId: string
}

export class AnonCredsMasterSecretRecord extends BaseRecord<DefaultAnonCredsMasterSecretTags, TagsBase> {
  public static readonly type = 'AnonCredsMasterSecretRecord'
  public readonly type = AnonCredsMasterSecretRecord.type

  public readonly masterSecretId!: string
  public readonly value?: string

  public constructor(props: AnonCredsMasterSecretRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
      this.masterSecretId = props.masterSecretId
      this.value = props.value
    }
  }

  public getTags() {
    return {
      ...this._tags,
      masterSecretId: this.masterSecretId,
    }
  }
}
