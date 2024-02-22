import { z } from 'zod'

import { ActionMenuFormParameter, actionMenuFormParameterSchema } from './ActionMenuOptionFormParameter'

// TODO(zod): these should not have any ts-expect-error and should return the type based on `Cls` input, not the generic
export const intoCls =
  <T>(Cls: unknown) =>
  (i: unknown): T =>
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //  @ts-expect-error
    new Cls(i)
export const arrIntoCls =
  <T>(Cls: unknown) =>
  (o: Array<unknown>): Array<T> =>
    o.map(intoCls(Cls))
export const intoOptCls =
  <T>(Cls: unknown) =>
  (i?: unknown): undefined | T =>
    i ? intoCls<T>(Cls)(i) : undefined

export const actionMenuFormSchema = z.object({
  description: z.string(),
  params: z
    .array(actionMenuFormParameterSchema)
    .transform(arrIntoCls<ActionMenuFormParameter>(ActionMenuFormParameter)),
})

export type ActionMenuFormOptions = z.input<typeof actionMenuFormSchema>

export class ActionMenuForm {
  public description: string
  public params: Array<ActionMenuFormParameter>

  public constructor(options: ActionMenuFormOptions) {
    const parsedOptions = actionMenuFormSchema.parse(options)
    this.description = parsedOptions.description
    this.params = parsedOptions.params
  }
}
