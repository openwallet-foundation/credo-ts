import * as _v from 'valibot'

import { ValibotValidationError } from '../error/ValibotValidationError'

export * from 'valibot'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BaseSchema = _v.BaseSchema<any, any, any>

export function parseWithErrorHandling<Schema extends BaseSchema>(
  schema: Schema,
  data: unknown,
  customErrorMessage?: string
): _v.InferOutput<Schema> {
  const parseResult = _v.safeParse(schema, data)

  if (!parseResult.success) {
    throw new ValibotValidationError(
      customErrorMessage ?? `Error validating schema with data ${JSON.stringify(data)}`,
      parseResult.issues
    )
  }

  return parseResult.output
}

const vUniqueArray = <const TItem extends _v.BaseSchema<unknown, unknown, _v.BaseIssue<unknown>>>(item: TItem) =>
  _v.pipe(
    _v.array(item),
    _v.check((a) => new Set<(typeof a)[number]>(a).size === a.length, 'Array must have unique values')
  )

const vOptionalToUndefined = <const TItem extends _v.BaseSchema<unknown, unknown, _v.BaseIssue<unknown>>>(
  item: TItem
) =>
  _v.optional(
    _v.pipe(
      item,
      _v.transform(() => undefined)
    )
  )

const vBase64Url = _v.pipe(_v.string(), _v.regex(/[a-zA-Z0-9_-]+/, 'Must be a base64url string'))

export { vUniqueArray as uniqueArray, vOptionalToUndefined as optionalToUndefined, vBase64Url as base64Url }
