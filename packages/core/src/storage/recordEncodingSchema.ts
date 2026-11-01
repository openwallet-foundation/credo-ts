import { z } from 'zod'
import { zIsoDate, zTypedObject } from '../utils/zod'
import type { TagsBase } from './BaseRecord'
import { Metadata, type MetadataBase } from './Metadata'

const zMetadata = z.codec(z.record(z.string(), z.unknown()), z.instanceof(Metadata), {
  decode: (data) => new Metadata(data as MetadataBase),
  encode: (metadata) => metadata.data,
})

/**
 * The properties of {@link BaseRecord}, included in every record encoding schema.
 *
 * These were not validated before, so they are optional to not reject records that are already stored.
 * Some records were stored without `createdAt`, and some storage services set the `id` after decoding.
 */
const baseRecordShape = {
  id: z.string().optional(),
  createdAt: zIsoDate.optional(),
  updatedAt: zIsoDate.optional(),
  metadata: zMetadata.optional(),
  _tags: zTypedObject<TagsBase>().optional(),
}

export interface CreateRecordEncodingSchemaOptions {
  /**
   * Converts a record stored in an older format to the current format, before it is validated.
   * Only applied when decoding.
   */
  upgrade?: (encoded: Record<string, unknown>) => Record<string, unknown>
}

/**
 * Creates the `encodingSchema` for a record, from the shape of the properties the record adds
 * to {@link BaseRecord}.
 *
 * - Properties not in the shape are kept as is. Storage migrations read and remove properties
 *   that are no longer part of the record, so these must not be dropped when decoding.
 * - `type` and `allowCache` are not stored.
 *
 * Properties that were never validated use `.nullish()`, as a stored record may contain `null` for these.
 *
 * @example
 * ```ts
 * const genericRecordEncodingSchema = createRecordEncodingSchema({
 *   content: z.record(z.string(), z.unknown()),
 * })
 *
 * class GenericRecord extends BaseRecord {
 *   public static get encodingSchema(): z.ZodType {
 *     return genericRecordEncodingSchema
 *   }
 * }
 * ```
 */
export function createRecordEncodingSchema<Shape extends z.core.$ZodLooseShape>(
  shape: Shape,
  options: CreateRecordEncodingSchemaOptions = {}
) {
  const decodedSchema = z.looseObject({ ...baseRecordShape, ...shape })

  return z.codec(z.looseObject({}), decodedSchema, {
    decode: ({ type, allowCache, ...encoded }) =>
      (options.upgrade ? options.upgrade(encoded) : encoded) as z.input<typeof decodedSchema>,
    encode: ({ type, allowCache, ...decoded }) => decoded,
  })
}
