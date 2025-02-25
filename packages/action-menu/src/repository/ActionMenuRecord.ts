import type { TagsBase } from '@credo-ts/core'
import type { ActionMenuRole } from '../ActionMenuRole'
import type { ActionMenuState } from '../ActionMenuState'

import { BaseRecord, CredoError, utils } from '@credo-ts/core'
import { Type } from 'class-transformer'

import { ActionMenu, ActionMenuSelection } from '../models'

/**
 * @public
 */
export interface ActionMenuRecordProps {
  id?: string
  state: ActionMenuState
  role: ActionMenuRole
  createdAt?: Date
  connectionId: string
  threadId: string
  menu?: ActionMenu
  performedAction?: ActionMenuSelection
  tags?: CustomActionMenuTags
}

/**
 * @public
 */
export type CustomActionMenuTags = TagsBase

/**
 * @public
 */
export type DefaultActionMenuTags = {
  role: ActionMenuRole
  connectionId: string
  threadId: string
}

/**
 * @public
 */
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
      this.id = props.id ?? utils.uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.connectionId = props.connectionId
      this.threadId = props.threadId
      this.state = props.state
      this.role = props.role
      this.menu = props.menu
      this.performedAction = props.performedAction
      this._tags = props.tags ?? {}
    }
  }

  public getTags() {
    return {
      ...this._tags,
      role: this.role,
      connectionId: this.connectionId,
      threadId: this.threadId,
    }
  }

  public assertState(expectedStates: ActionMenuState | ActionMenuState[]) {
    if (!Array.isArray(expectedStates)) {
      // biome-ignore lint/style/noParameterAssign: <explanation>
      expectedStates = [expectedStates]
    }

    if (!expectedStates.includes(this.state)) {
      throw new CredoError(
        `Action Menu record is in invalid state ${this.state}. Valid states are: ${expectedStates.join(', ')}.`
      )
    }
  }

  public assertRole(expectedRole: ActionMenuRole) {
    if (this.role !== expectedRole) {
      throw new CredoError(`Action Menu record has invalid role ${this.role}. Expected role ${expectedRole}.`)
    }
  }
}
