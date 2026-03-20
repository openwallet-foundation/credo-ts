import { z } from 'zod'
import { ZodValidationError } from '../error'
import type { Uint8ArrayBuffer } from '../types'
import { JsonEncoder } from '.'

// biome-ignore lint/suspicious/noExplicitAny: no explanation
export type zBaseSchema = z.Schema<any, any, any>

export function zParseWithErrorHandling<Schema extends zBaseSchema>(
  schema: Schema,
  data: unknown,
  customErrorMessage?: string
): z.output<Schema> {
  const parseResult = schema.safeParse(data)

  if (!parseResult.success) {
    throw new ZodValidationError(
      customErrorMessage ?? `Error validating schema with data ${JsonEncoder.toString(data)}`,
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

const zUint8ArrayBuffer = z.instanceof<{ new (): Uint8ArrayBuffer }>(Uint8Array)

export { zUniqueArray, zOptionalToUndefined, zBase64Url, zUint8ArrayBuffer }
