import { MediationRecord } from '.'
import { BaseRecord, RecordType } from '../../../storage/BaseRecord'

export const DEFAULT_MEDIATOR_RECORD_TYPE = 'default_mediator'

export interface DefaultMediationProps {
  createdAt?: number
  tags?: { [keys: string]: string }
  mediationId: string
}

export class DefaultMediatorRecord extends BaseRecord {
  public mediationId: string

  public static readonly type: RecordType = RecordType.DefaultMediationRecord
  public readonly type = MediationRecord.type

  public constructor(props: DefaultMediationProps) {
    super(DEFAULT_MEDIATOR_RECORD_TYPE, props.createdAt ?? Date.now())
    this.mediationId = props.mediationId
    this.tags = props.tags || {}
  }
}
