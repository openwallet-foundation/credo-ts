import { z } from 'zod'

export enum ActionMenuFormInputType {
  Text = 'text',
}

export const actionMenuFormParameterSchema = z.object({
  name: z.string(),
  title: z.string(),
  description: z.string(),
  default: z.string().optional(),
  required: z.boolean().optional(),
  type: z.nativeEnum(ActionMenuFormInputType),
})

export type ActionMenuFormParameterOptions = z.input<typeof actionMenuFormParameterSchema>

export class ActionMenuFormParameter {
  public name: string
  public title: string
  public description: string
  public default?: string
  public required?: boolean
  public type: ActionMenuFormInputType

  public constructor(options: ActionMenuFormParameterOptions) {
    const parsedOptions = actionMenuFormParameterSchema.parse(options)
    this.name = parsedOptions.name
    this.title = parsedOptions.title
    this.description = parsedOptions.description
    this.default = parsedOptions.default
    this.required = parsedOptions.required
    this.type = parsedOptions.type
  }
}
