import { UnionToIntersection } from '@credo-ts/core'
import { DrizzleRecord } from './DrizzleRecord'

/**
 * Extracts and combines schema types from an array of DrizzleRecord objects for a specific database type
 */
export type GetSchemaFromDrizzleRecords<
  Schemas extends readonly DrizzleRecord[],
  DatabaseType extends 'postgres' | 'sqlite',
> = UnionToIntersection<
  {
    [K in keyof Schemas]: Schemas[K][DatabaseType]
  }[number]
>

/**
 * Combines multiple Drizzle schema objects into a single unified schema
 * @param schemas - Array of schema objects to combine
 * @returns A single merged schema object
 */
export function getSchemaFromDrizzleRecords<
  DrizzleRecords extends Array<DrizzleRecord> | ReadonlyArray<DrizzleRecord>,
  DatabaseType extends 'postgres' | 'sqlite',
>(
  drizzleRecords: DrizzleRecords,
  databaseType: DatabaseType
): GetSchemaFromDrizzleRecords<DrizzleRecords, DatabaseType> {
  // Create a new empty object to hold our combined schema
  const combinedSchema = {} as GetSchemaFromDrizzleRecords<DrizzleRecords, DatabaseType>

  // Iterate through each schema and merge its properties into the combined schema
  for (const drizzleRecord of drizzleRecords) {
    const schema = drizzleRecord[databaseType]

    for (const key in schema) {
      if (Object.prototype.hasOwnProperty.call(schema, key)) {
        // Merge each property from the current schema into our combined schema
        Object.assign(combinedSchema as object, { [key]: schema[key] })
      }
    }
  }

  return combinedSchema
}
