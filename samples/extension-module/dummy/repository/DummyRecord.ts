import { BaseRecord, utils } from '@credo-ts/core'
import type { DummyState } from './DummyState'

export interface DummyStorageProps {
  id?: string
  createdAt?: Date
  connectionId: string
  threadId: string
  state: DummyState
}

export class DummyRecord extends BaseRecord implements DummyStorageProps {
  public connectionId!: string
  public threadId!: string
  public state!: DummyState

  public static readonly type = 'DummyRecord'
  public readonly type = DummyRecord.type

  public constructor(props: DummyStorageProps) {
    super()
    if (props) {
      this.id = props.id ?? utils.uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.state = props.state
      this.connectionId = props.connectionId
      this.threadId = props.threadId
    }
  }

  public getTags() {
    return {
      ...this._tags,
      threadId: this.threadId,
      connectionId: this.connectionId,
      state: this.state,
    }
  }

  public assertState(dummyStates: DummyState | DummyState[]) {
    let expectedStates: DummyState[] = []
    if (!Array.isArray(dummyStates)) {
      expectedStates = [dummyStates]
    }

    if (!expectedStates.includes(this.state)) {
      throw new Error(`Dummy record is in invalid state ${this.state}. Valid states are: ${expectedStates.join(', ')}.`)
    }
  }
}
