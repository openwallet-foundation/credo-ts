import type { VersionString } from '../../../utils/version'

import { uuid } from '../../../utils/uuid'
import { BaseRecord } from '../../BaseRecord'

export interface StorageVersionRecordProps {
  id?: string
  createdAt?: Date
  storageVersion: VersionString
}

export class StorageVersionRecord extends BaseRecord {
  public storageVersion!: VersionString

  public static readonly type = 'StorageVersionRecord'
  public readonly type = StorageVersionRecord.type

  public constructor(props: StorageVersionRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.storageVersion = props.storageVersion
    }
  }

  public getTags() {
    return this._tags
  }
}
