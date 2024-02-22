import { AgentMessage, parseMessageType, utils } from '@credo-ts/core'
import { z } from 'zod'

import { ActionMenuOption } from '../models'
import { actionMenuOptionSchema } from '../models/ActionMenuOption'
import { arrIntoCls } from '../models/ActionMenuOptionForm'

const menuMessageSchema = z
  .object({
    id: z.string().default(utils.uuid()),
    title: z.string(),
    description: z.string(),
    errormsg: z.string().optional(),
    options: z.array(actionMenuOptionSchema).transform(arrIntoCls<ActionMenuOption>(ActionMenuOption)),
    threadId: z.string().optional(),
  })
  .transform((o) => ({
    ...o,
    errorMessage: o.errormsg,
  }))

export type MenuMessageOptions = z.input<typeof menuMessageSchema>

export class MenuMessage extends AgentMessage {
  public readonly type = MenuMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/action-menu/1.0/menu')

  public title: string
  public description: string
  public errorMessage?: string
  public options: Array<ActionMenuOption>

  public constructor(options: MenuMessageOptions) {
    super()

    const parsedOptions = menuMessageSchema.parse(options)
    this.id = parsedOptions.id
    this.title = parsedOptions.title
    this.description = parsedOptions.description
    this.errorMessage = parsedOptions.errorMessage
    this.options = parsedOptions.options
  }
}
