import { uuid } from '../../utils/uuid'
import type { TagsBase } from '../BaseRecord'
import { BaseRecord } from '../BaseRecord'

export interface TestRecordProps {
  id?: string
  createdAt?: Date
  tags?: TagsBase
  foo: string
}

export class TestRecord extends BaseRecord {
  public foo!: string

  public constructor(props?: TestRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()

      this.foo = props.foo
      this._tags = props.tags ?? {}
    }
  }

  public getTags(): TagsBase {
    return this._tags
  }
}
