import type { TagsBase } from '@credo-ts/core'
import { BaseRecord, CredoError, createRecordEncodingSchema, utils, zJsonTransformerClass } from '@credo-ts/core'
import { z } from 'zod'
import type { ActionMenuRole } from '../ActionMenuRole'
import type { ActionMenuState } from '../ActionMenuState'

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
const actionMenuRecordEncodingSchema = createRecordEncodingSchema({
  state: z.string().optional(),
  role: z.string().optional(),
  connectionId: z.string().optional(),
  threadId: z.string().optional(),
  menu: zJsonTransformerClass(() => ActionMenu, { validate: false }).optional(),
  performedAction: zJsonTransformerClass(() => ActionMenuSelection, { validate: false }).optional(),
})

export class ActionMenuRecord
  extends BaseRecord<DefaultActionMenuTags, CustomActionMenuTags>
  implements ActionMenuRecordProps
{
  public static get encodingSchema() {
    return actionMenuRecordEncodingSchema
  }

  public state!: ActionMenuState
  public role!: ActionMenuRole
  public connectionId!: string
  public threadId!: string

  public menu?: ActionMenu

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
