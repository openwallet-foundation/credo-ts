import { MediationRecord } from '.'
import { BaseRecord } from '../../../storage/BaseRecord'

export interface DefaultMediationProps {
  mediationId: string
}

export class DefaultMediationRecord extends BaseRecord implements DefaultMediationProps {
  public mediationId: string

  public static readonly type = 'DefaultMediationRecord'
  public readonly type = DefaultMediationRecord.type

  public constructor(props: DefaultMediationProps) {
    super()
    this.createdAt = new Date()
    this.mediationId = props.mediationId
  }
}
