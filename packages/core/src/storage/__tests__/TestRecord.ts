import { uuid } from '../../utils/uuid'
import { BaseRecord } from '../BaseRecord'

export interface TestRecordProps {
  id?: string
  createdAt?: Date
  tags: { [keys: string]: string }
  foo: string
}

export class TestRecord extends BaseRecord {
  public foo!: string

  public constructor(props: TestRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()

      this.foo = props.foo
      this.tags = props.tags
    }
  }
}
