import { CredoError, BaseRecord, utils } from '@credo-ts/core'
import { z } from 'zod'

import { ActionMenuRole } from '../ActionMenuRole'
import { ActionMenuState } from '../ActionMenuState'
import { ActionMenu, ActionMenuSelection } from '../models'
import { actionMenuSchema } from '../models/ActionMenu'
import { intoOptCls } from '../models/ActionMenuOptionForm'
import { actionMenuSelectionSchema } from '../models/ActionMenuSelection'

// TODO(zod): figure out how we can set the key type on a `z.record()`
const tagsBaseSchema = z.record(
  z.string(),
  z.union([z.string(), z.boolean(), z.undefined(), z.array(z.string()), z.null()])
)
const customActionMenuTagsSchema = tagsBaseSchema

const recordSchema = z.object({
  id: z.string().default(utils.uuid()),
  createdAt: z.date().default(new Date()),
})

const actionMenuRecordSchema = recordSchema.extend({
  state: z.nativeEnum(ActionMenuState),
  role: z.nativeEnum(ActionMenuRole),
  connectionId: z.string(),
  threadId: z.string(),
  menu: actionMenuSchema.optional().transform(intoOptCls<ActionMenu>(ActionMenu)),
  performedAction: actionMenuSelectionSchema.optional().transform(intoOptCls<ActionMenuSelection>(ActionMenuSelection)),
  tags: customActionMenuTagsSchema.optional(),
})

export type ActionMenuRecordOptions = z.input<typeof actionMenuRecordSchema>
export type CustomActionMenuTags = z.input<typeof customActionMenuTagsSchema>

/**
 * @public
 */
export type DefaultActionMenuTags = {
  role: ActionMenuRole
  connectionId: string
  threadId: string
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
export class ActionMenuRecord extends BaseRecord<DefaultActionMenuTags, CustomActionMenuTags> {
  public static readonly type = 'ActionMenuRecord'
  public readonly type = ActionMenuRecord.type

  public state: ActionMenuState
  public role: ActionMenuRole
  public connectionId: string
  public threadId: string
  public menu?: ActionMenu
  public performedAction?: ActionMenuSelection

  public constructor(options: ActionMenuRecordOptions) {
    super()

    const parsedOptions = actionMenuRecordSchema.parse(options)
    this.id = parsedOptions.id
    this.state = parsedOptions.state
    this.role = parsedOptions.role
    this.connectionId = parsedOptions.connectionId
    this.threadId = parsedOptions.threadId
    this.menu = parsedOptions.menu
    this.performedAction = parsedOptions.performedAction
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
