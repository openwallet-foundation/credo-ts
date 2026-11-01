import { z } from 'zod'
import { ZodValidationError } from '../error'

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
      customErrorMessage ?? `Error validating schema with data ${JSON.stringify(data)}`,
      parseResult.error
    )
  }

  return parseResult.data
}

export function zDecodeWithErrorHandling<Schema extends zBaseSchema>(
  schema: Schema,
  data: z.input<Schema>,
  customErrorMessage?: string
): z.output<Schema> {
  const decodeResult = z.safeDecode(schema, data)

  if (!decodeResult.success) {
    throw new ZodValidationError(customErrorMessage ?? 'Error decoding data', decodeResult.error)
  }

  return decodeResult.data
}

export function zEncodeWithErrorHandling<Schema extends zBaseSchema>(
  schema: Schema,
  data: z.output<Schema>,
  customErrorMessage?: string
): z.input<Schema> {
  const encodeResult = z.safeEncode(schema, data)

  if (!encodeResult.success) {
    throw new ZodValidationError(customErrorMessage ?? 'Error encoding data', encodeResult.error)
  }

  return encodeResult.data
}

// biome-ignore lint/suspicious/noExplicitAny: no explanation
export type ClassConstructor<T> = { new (...args: any[]): T }

/**
 * A class that is encoded and decoded using a zod schema, instead of class-transformer and class-validator.
 *
 * The `encodingSchema` is a zod codec. Decoding turns the JSON representation into the properties of the
 * class instance, encoding turns a class instance into the JSON representation.
 *
 * Instances are created using `new Class()` without arguments, after which the decoded properties are assigned.
 * The constructor must handle being called without arguments.
 */
export interface ZodEncodedClass<T = unknown> extends ClassConstructor<T> {
  readonly encodingSchema: zBaseSchema
}

/**
 * Returns the zod encoding schema of a class, if it has one.
 */
export function getEncodingSchema(cls: unknown): zBaseSchema | undefined {
  if (typeof cls !== 'function') return undefined

  const encodingSchema: unknown = (cls as Partial<ZodEncodedClass>).encodingSchema

  // We don't use instanceof, so schemas from a different zod instance are also detected
  if (typeof encodingSchema === 'object' && encodingSchema !== null && '_zod' in encodingSchema) {
    return encodingSchema as zBaseSchema
  }

  return undefined
}

const zUniqueArray = <const TItem extends zBaseSchema>(item: TItem) =>
  z.array(item).refine((a) => new Set<(typeof a)[number]>(a).size === a.length, 'Array must have unique values')

const zOptionalToUndefined = <const TItem extends zBaseSchema>(item: TItem) =>
  z.optional(item.transform(() => undefined))

const zBase64Url = z.string().regex(/[a-zA-Z0-9_-]+/, 'Must be a base64url string')

const zAnyUint8Array = z.instanceof<{ new (): Uint8Array }>(Uint8Array)

const zNonEmptyArray = <const TItem extends zBaseSchema>(item: TItem) => z.tuple([item], item)

/**
 * A date, encoded as an ISO 8601 string.
 *
 * Decoding also accepts a `Date`, as some storage backends return dates as `Date` instances.
 */
const zIsoDate = z.codec(
  z.union([z.string(), z.date()]).refine((value) => !Number.isNaN(new Date(value).getTime()), 'Must be a valid date'),
  z.date(),
  {
    decode: (value) => new Date(value),
    encode: (date) => date.toISOString(),
  }
)

/**
 * An object of type `T`, of which the structure is not validated.
 *
 * Used for values that were never validated, as validating them now could reject values that
 * are already stored.
 *
 * Can be replaced by a schema for the structure in the future. Where the stored format may differ
 * from the type, this needs a storage migration or `zWithUpgrade`.
 */
const zTypedObject = <T extends object>() =>
  z.custom<T>((value) => typeof value === 'object' && value !== null && !Array.isArray(value), 'Must be an object')

/**
 * Upgrades a value stored in an older format to the current format, before it is validated
 * with `schema`. Encoding is not changed.
 */
const zWithUpgrade = <const Schema extends zBaseSchema>(schema: Schema, upgrade: (value: unknown) => unknown) =>
  z.codec(z.unknown(), schema, {
    decode: (value) => upgrade(value) as z.input<Schema>,
    encode: (value) => value,
  })

/**
 * A `Map` with string keys, encoded as an object.
 */
const zMapFromObject = <const TValue extends zBaseSchema>(value: TValue) =>
  z.codec(z.record(z.string(), z.unknown()), z.map(z.string(), value), {
    decode: (object) => new Map(Object.entries(object) as Array<[string, z.input<TValue>]>),
    encode: (map) => Object.fromEntries(map.entries()),
  })

export {
  zAnyUint8Array,
  zBase64Url,
  zIsoDate,
  zMapFromObject,
  zNonEmptyArray,
  zOptionalToUndefined,
  zTypedObject,
  zUniqueArray,
  zWithUpgrade,
}
