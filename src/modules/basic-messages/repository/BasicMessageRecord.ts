import { v4 as uuid } from 'uuid'
import { BaseRecord, RecordType, Tags } from '../../../storage/BaseRecord'

export interface BasicMessageStorageProps {
  id?: string
  createdAt?: number
  tags: Tags

  content: string
  sentTime: string
}

export class BasicMessageRecord extends BaseRecord implements BasicMessageStorageProps {
  public content: string
  public sentTime: string

  public static readonly type: RecordType = RecordType.BasicMessageRecord
  public readonly type = BasicMessageRecord.type

  public constructor(props: BasicMessageStorageProps) {
    super(props.id ?? uuid(), props.createdAt ?? Date.now())
    this.content = props.content
    this.sentTime = props.sentTime
    this.tags = props.tags
  }
}
