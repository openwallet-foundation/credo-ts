import { BaseRecord, Tags } from '../../../storage/BaseRecord'
import { uuid } from '../../../utils/uuid'

export interface BasicMessageStorageProps {
  id?: string
  createdAt?: Date
  tags: Tags

  content: string
  sentTime: string
}

export class BasicMessageRecord extends BaseRecord implements BasicMessageStorageProps {
  public content!: string
  public sentTime!: string

  public static readonly type = 'BasicMessageRecord'
  public readonly type = BasicMessageRecord.type

  public constructor(props: BasicMessageStorageProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.content = props.content
      this.sentTime = props.sentTime
      this.tags = props.tags
    }
  }
}
