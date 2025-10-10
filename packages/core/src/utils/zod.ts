import { z } from 'zod'

import { ZodValidationError } from '../error'

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export type zBaseSchema = z.Schema<any, any, any>

export function zParseWithErrorHandling<Schema extends zBaseSchema>(
  schema: Schema,
  data: unknown,
  customErrorMessage?: string
): z.output<Schema> {
  const parseResult = schema.safeParse(data)

  if (!parseResult.success) {
    throw new ZodValidationError(
      customErrorMessage ?? `Error validating schema with data ${JSON.stringify(data)}`,
      parseResult.error
    )
  }

  return parseResult.data
}

const zUniqueArray = <const TItem extends zBaseSchema>(item: TItem) =>
  z.array(item).refine((a) => new Set<(typeof a)[number]>(a).size === a.length, 'Array must have unique values')

const zOptionalToUndefined = <const TItem extends zBaseSchema>(item: TItem) =>
  z.optional(item.transform(() => undefined))

const zBase64Url = z.string().regex(/[a-zA-Z0-9_-]+/, 'Must be a base64url string')

export { zUniqueArray, zOptionalToUndefined, zBase64Url }
