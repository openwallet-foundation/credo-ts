import { z } from 'zod'

import { ZodValidationError } from '../error'

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export type BaseSchema = z.Schema<any, any, any>

export function parseWithErrorHandling<Schema extends BaseSchema>(
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

const zUniqueArray = <const TItem extends BaseSchema>(item: TItem) =>
  z.array(item).refine((a) => new Set<(typeof a)[number]>(a).size === a.length, 'Array must have unique values')

const zOptionalToUndefined = <const TItem extends BaseSchema>(item: TItem) =>
  z.optional(item.transform(() => undefined))

const zBase64Url = z.string().regex(/[a-zA-Z0-9_-]+/, 'Must be a base64url string')

export * from 'zod'
export { zUniqueArray as uniqueArray, zOptionalToUndefined as optionalToUndefined, zBase64Url as base64Url }
