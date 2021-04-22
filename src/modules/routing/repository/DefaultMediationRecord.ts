import { MediationRecord } from '.'
import { BaseRecord, RecordType } from '../../../storage/BaseRecord'

export const DEFAULT_MEDIATOR_RECORD_TYPE = 'default_mediator'

export interface DefaultMediationProps {
  mediationId: string
}

export class DefaultMediationRecord extends BaseRecord implements DefaultMediationProps {
  public mediationId: string

  public static readonly type: RecordType = RecordType.DefaultMediationRecord
  public readonly type = MediationRecord.type

  public constructor(props: DefaultMediationProps) {
    super(DEFAULT_MEDIATOR_RECORD_TYPE, Date.now())
    this.mediationId = props.mediationId
  }
}
