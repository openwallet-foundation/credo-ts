import type { TagsBase } from '../../../storage/BaseRecord'
import type { OutOfBandRole } from '../OutOfBandRole'
import type { OutOfBandState } from '../OutOfBandState'

import { Type } from 'class-transformer'

import { BaseRecord } from '../../../storage/BaseRecord'
import { uuid } from '../../../utils/uuid'
import { OutOfBandInvitationMessage } from '../messages/OutOfBandInvitationMessage'

export interface OutOfBandRecordProps {
  id?: string
  createdAt?: Date
  invitation: OutOfBandInvitationMessage
  state: OutOfBandState
  role: OutOfBandRole
  errorMessage?: string
}

export type CustomOutOfBandTags = TagsBase
export type DefaultOutOfBandTags = {
  state: OutOfBandState
  role: OutOfBandRole
}

export class OutOfBandRecord
  extends BaseRecord<DefaultOutOfBandTags, CustomOutOfBandTags>
  implements OutOfBandRecordProps
{
  public state!: OutOfBandState
  public role!: OutOfBandRole

  @Type(() => OutOfBandInvitationMessage)
  public invitation!: OutOfBandInvitationMessage

  public errorMessage?: string

  public static readonly type = 'OutOfBandRecord'
  public readonly type = OutOfBandRecord.type

  public constructor(props: OutOfBandRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.state = props.state
      this.role = props.role
      this.invitation = props.invitation
      this.errorMessage = props.errorMessage
    }
  }

  public getTags() {
    return {
      ...this._tags,
      state: this.state,
      role: this.role,
    }
  }
}
