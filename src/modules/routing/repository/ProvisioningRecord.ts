import type { TagsBase } from '../../../storage/BaseRecord'

import { BaseRecord } from '../../../storage/BaseRecord'
import { uuid } from '../../../utils/uuid'

interface ProvisioningRecordProps {
  id: string
  createdAt?: Date
  tags?: TagsBase
  mediatorConnectionId: string
  mediatorPublicVerkey: string
}

export class ProvisioningRecord extends BaseRecord {
  public mediatorConnectionId!: string
  public mediatorPublicVerkey!: string

  public static readonly type = 'ProvisioningRecord'
  public readonly type = ProvisioningRecord.type

  public constructor(props: ProvisioningRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.mediatorConnectionId = props.mediatorConnectionId
      this.mediatorPublicVerkey = props.mediatorPublicVerkey
      this._tags = props.tags || {}
    }
  }

  public getTags() {
    return this._tags
  }
}
