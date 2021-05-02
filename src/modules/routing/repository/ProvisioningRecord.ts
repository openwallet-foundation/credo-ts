import { uuid } from '../../../utils/uuid'
import { BaseRecord } from '../../../storage/BaseRecord'

interface ProvisioningRecordProps {
  id: string
  createdAt?: Date
  tags?: { [keys: string]: string }
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
      this.tags = props.tags || {}
    }
  }
}
