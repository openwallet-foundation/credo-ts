import type { VersionString } from '../../../utils/version'

import { BaseRecord } from '../../BaseRecord'
import { CURRENT_FRAMEWORK_STORAGE_VERSION, STORAGE_VERSION_RECORD_ID } from '../updates'

export interface StorageVersionRecordProps {
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
      this.id = StorageVersionRecord.storageVersionRecordId
      this.createdAt = props.createdAt ?? new Date()
      this.storageVersion = props.storageVersion
    }
  }

  public getTags() {
    return this._tags
  }

  public static get frameworkStorageVersion() {
    return CURRENT_FRAMEWORK_STORAGE_VERSION
  }

  public static get storageVersionRecordId() {
    return STORAGE_VERSION_RECORD_ID
  }
}
