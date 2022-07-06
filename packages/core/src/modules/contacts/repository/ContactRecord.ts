import {
  BaseRecord
} from '@aries-framework/core'
import { uuid } from '../../../utils/uuid'
import { RecordTags, TagsBase } from '../../../storage/BaseRecord'

export interface ContactStorageProps {
  id?: string
  createdAt?: Date
  did: string
  name: string
  tags?: CustomContactTags
}

export type CustomContactTags = TagsBase
export type DefaultContactTags = {
  did: string
  name: string
}

export type ContactTags = RecordTags<ContactRecord>

export class ContactRecord extends BaseRecord<DefaultContactTags, CustomContactTags> {
  public did!: string
  public name!: string

  public static readonly type = 'ContactRecord'
  // public readonly type = ValueTransferRecord.type

  public constructor(props: ContactStorageProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.did = props.did
      this.name = props.name
      this._tags = props.tags ?? {}
    }
  }

  public getTags() {
    return {
      ...this._tags,
      did: this.did,
      name: this.name
    }
  }
}
