import type { Verkey } from 'indy-sdk'
import { v4 as uuid } from 'uuid'
import { BaseRecord, RecordType } from '../../../storage/BaseRecord'

interface MediationRecipientRecordProps {
  id: string
  createdAt?: number
  tags?: { [keys: string]: string }
  mediatorConnectionId: string
  recipientKeys: [Verkey]
  endPoint: string
}

export class MediationRecipientRecord extends BaseRecord {
  public mediatorConnectionId: string
  public endPoint: string
  public recipientKeys: [Verkey]

  public static readonly type: RecordType = RecordType.MediationRecipientRecord
  public readonly type = MediationRecipientRecord.type

  public constructor(props: MediationRecipientRecordProps) {
    super(props.id ?? uuid(), props.createdAt ?? Date.now())
    this.mediatorConnectionId = props.mediatorConnectionId
    this.endPoint = props.endPoint
    this.recipientKeys = props.recipientKeys
    this.tags = props.tags || {}
  }
}
