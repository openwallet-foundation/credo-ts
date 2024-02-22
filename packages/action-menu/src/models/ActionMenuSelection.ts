import { z } from 'zod'

export const actionMenuSelectionSchema = z.object({
  name: z.string(),
  params: z.record(z.string()).optional(),
})

export type ActionMenuSelectionOptions = z.input<typeof actionMenuSelectionSchema>

export class ActionMenuSelection {
  public name: string
  public params?: Record<string, string>

  public constructor(options: ActionMenuSelectionOptions) {
    const parsedOptions = actionMenuSelectionSchema.parse(options)
    this.name = parsedOptions.name
    this.params = parsedOptions.params
  }
}
