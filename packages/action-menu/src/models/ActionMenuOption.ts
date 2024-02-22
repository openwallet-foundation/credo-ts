import { z } from 'zod'

import { ActionMenuForm, actionMenuFormSchema, intoOptCls } from './ActionMenuOptionForm'

export const actionMenuOptionSchema = z.object({
  name: z.string(),
  title: z.string(),
  description: z.string(),
  disabled: z.boolean().optional(),
  form: actionMenuFormSchema.optional().transform(intoOptCls<ActionMenuForm>(ActionMenuForm)),
})

export type ActionMenuOptionOptions = z.input<typeof actionMenuOptionSchema>

export class ActionMenuOption {
  public name: string
  public title: string
  public description: string
  public disabled?: boolean
  public form?: ActionMenuForm

  public constructor(options: ActionMenuOptionOptions) {
    const parsedOptions = actionMenuOptionSchema.parse(options)
    this.name = parsedOptions.name
    this.title = parsedOptions.title
    this.description = parsedOptions.description
    this.disabled = parsedOptions.disabled
    this.form = parsedOptions.form
  }
}
