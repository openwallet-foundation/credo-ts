import { z } from 'zod'
import type { VersionString } from '../../../utils/version'
import { BaseRecord } from '../../BaseRecord'
import { createRecordEncodingSchema } from '../../recordEncodingSchema'
import { CURRENT_FRAMEWORK_STORAGE_VERSION, STORAGE_VERSION_RECORD_ID } from '../updates'

export interface StorageVersionRecordProps {
  createdAt?: Date
  storageVersion: VersionString
}

const storageVersionRecordEncodingSchema = createRecordEncodingSchema({
  storageVersion: z.string().optional(),
})

export class StorageVersionRecord extends BaseRecord {
  public static get encodingSchema(): z.ZodType {
    return storageVersionRecordEncodingSchema
  }

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
