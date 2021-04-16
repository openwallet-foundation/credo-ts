import type { Verkey } from 'indy-sdk'
import { v4 as uuid } from 'uuid'
import { BaseRecord, RecordType } from '../../../storage/BaseRecord'

export interface MediationRecordProps {
  id?: string
  createdAt?: number
  tags?: { [keys: string]: string }
  connectionId: string
  recipientKey: Verkey
}

export class MediationRecord extends BaseRecord {
  public mediatorConnectionId: string
  public routingKeys: [Verkey]

  public static readonly type: RecordType = RecordType.MediationRecord
  public readonly type = MediationRecord.type

  public constructor(props: MediationRecordProps) {
    super(props.id ?? uuid(), props.createdAt ?? Date.now())
    this.mediatorConnectionId = props.connectionId
    this.routingKeys = [props.recipientKey]
    this.tags = props.tags || {}
  }
}
