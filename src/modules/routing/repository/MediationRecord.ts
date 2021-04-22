import type { Verkey } from 'indy-sdk'
import { v4 as uuid } from 'uuid'
import { BaseRecord, RecordType, Tags } from '../../../storage/BaseRecord'
import { ConnectionRecord } from '../../connections'

export interface MediationRecordProps {
  id?: string
  state: string
  role: string
  createdAt?: number
  tags?: { [keys: string]: string }
  connectionId: string
  recipientKeys?: [Verkey]
}

export interface MediationTags extends Tags {
  state: string
  role: string
  connectionId: string
}

export class MediationRecord extends BaseRecord {
  public mediatorConnectionId: string
  public routingKeys?: [Verkey]

  public static readonly type: RecordType = RecordType.MediationRecord
  public readonly type = MediationRecord.type

  public constructor(props: MediationRecordProps) {
    super(props.id ?? uuid(), props.createdAt ?? Date.now())
    this.mediatorConnectionId = props.connectionId
    if (props.recipientKeys !== undefined) {
      this.routingKeys = props.recipientKeys
    }
    this.tags = props.tags || {}
  }
}
