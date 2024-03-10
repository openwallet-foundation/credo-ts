import { z } from 'zod'

import { ActionMenuOption, actionMenuOptionSchema } from './ActionMenuOption'
import { arrIntoCls } from './ActionMenuOptionForm'

export const actionMenuSchema = z.object({
  title: z.string(),
  description: z.string(),
  options: z.array(actionMenuOptionSchema).transform(arrIntoCls<ActionMenuOption>(ActionMenuOption)),
})

export type ActionMenuOptions = z.input<typeof actionMenuSchema>

export class ActionMenu {
  public title: string
  public description: string
  public options: Array<ActionMenuOption>

  public constructor(options: ActionMenuOptions) {
    const parsedOptions = actionMenuSchema.parse(options)
    this.title = parsedOptions.title
    this.description = parsedOptions.description
    this.options = parsedOptions.options
  }
}
