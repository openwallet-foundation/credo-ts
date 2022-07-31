import type { TagsBase } from '../../../storage/BaseRecord'
import type { ActionMenuRole } from '../ActionMenuRole'
import type { ActionMenuState } from '../ActionMenuState'

import { Type } from 'class-transformer'

import { AriesFrameworkError } from '../../../error'
import { BaseRecord } from '../../../storage/BaseRecord'
import { uuid } from '../../../utils/uuid'
import { ActionMenuSelection, ActionMenu } from '../models'

export interface ActionMenuRecordProps {
  id?: string
  state: ActionMenuState
  role: ActionMenuRole
  createdAt?: Date
  connectionId: string
  threadId: string
  menu?: ActionMenu
  performSelection?: ActionMenuSelection
  tags?: CustomActionMenuTags
}

export type CustomActionMenuTags = TagsBase

export type DefaultActionMenuTags = {
  role: ActionMenuRole
  connectionId: string
  state: ActionMenuState
  threadId: string
}

export class ActionMenuRecord
  extends BaseRecord<DefaultActionMenuTags, CustomActionMenuTags>
  implements ActionMenuRecordProps
{
  public state!: ActionMenuState
  public role!: ActionMenuRole
  public connectionId!: string
  public threadId!: string

  @Type(() => ActionMenu)
  public menu?: ActionMenu

  @Type(() => ActionMenuSelection)
  public performedAction?: ActionMenuSelection

  public static readonly type = 'ActionMenuRecord'
  public readonly type = ActionMenuRecord.type

  public constructor(props: ActionMenuRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.connectionId = props.connectionId
      this.threadId = props.threadId
      this.state = props.state
      this.role = props.role
      this.menu = props.menu
      this.performedAction = props.performSelection
      this._tags = props.tags ?? {}
    }
  }

  public getTags() {
    return {
      ...this._tags,
      state: this.state,
      role: this.role,
      connectionId: this.connectionId,
      threadId: this.threadId,
    }
  }

  public assertState(expectedStates: ActionMenuState | ActionMenuState[]) {
    if (!Array.isArray(expectedStates)) {
      expectedStates = [expectedStates]
    }

    if (!expectedStates.includes(this.state)) {
      throw new AriesFrameworkError(
        `Action Menu record is in invalid state ${this.state}. Valid states are: ${expectedStates.join(', ')}.`
      )
    }
  }

  public assertRole(expectedRole: ActionMenuRole) {
    if (this.role !== expectedRole) {
      throw new AriesFrameworkError(`Action Menu record has invalid role ${this.role}. Expected role ${expectedRole}.`)
    }
  }
}
