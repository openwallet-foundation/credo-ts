import { BaseRecord, Query } from '@credo-ts/core'
import { SQL, SQLWrapper, and, eq, not, or, sql } from 'drizzle-orm'
import { sqliteTable } from 'drizzle-orm/sqlite-core'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import { sqliteBaseRecordTable } from '../sqlite'

/**
 * Helper function to safely convert a value to a JSON string
 */
function toJsonString(value: unknown): string {
  return JSON.stringify(value)
}

/**
 * Checks if an array column (stored as JSON text in SQLite) contains all values from the given array
 *
 * @param column The column storing the JSON array
 * @param values Array of values that should be contained in the column
 * @returns SQL condition that checks if all values are in the array
 */
function arrayContainsAll<T extends AnySQLiteColumn>(column: T, values: unknown[]): SQL<unknown> {
  if (values.length === 0) {
    return sql`1=1` // Empty array always matches
  }

  // In SQLite, we need to use the JSON_EACH function to check array containment
  // For each value, we create a condition checking if it exists in the JSON array
  const conditions = values.map((value) => {
    const jsonVal = toJsonString(value)
    return sql`EXISTS (SELECT 1 FROM JSON_EACH(${column}) WHERE JSON_EACH.value = JSON(${jsonVal}))`
  })

  // Combine all conditions with AND
  return sql.join(conditions, sql` AND `)
}

/**
 * Checks if a JSON array within a JSON object contains all values from a given array
 *
 * @param column The column storing the JSON object
 * @param path Path to the JSON array property
 * @param values Array of values to check for containment
 * @returns SQL condition that checks if all values are contained in the array
 */
function jsonArrayContainsAll<T extends AnySQLiteColumn>(
  column: T,
  path: Array<string | number>,
  values: unknown[]
): SQL<unknown> {
  if (values.length === 0) {
    return sql`1=1` // Empty array always matches
  }

  // Build the JSON path
  const jsonPath = path.length > 0 ? buildJsonPathForExtract(path) : '$'

  // Create conditions for each value in the array
  const conditions = values.map((value) => {
    const jsonVal = toJsonString(value)
    return sql`EXISTS (
      SELECT 1 
      FROM JSON_EACH(JSON_EXTRACT(${column}, ${jsonPath})) 
      WHERE JSON_EACH.value = JSON(${jsonVal})
    )`
  })

  // Combine all conditions with AND
  return sql.join(conditions, sql` AND `)
}

/**
 * Builds a JSON path string for use with JSON_EXTRACT
 */
function buildJsonPathForExtract(path: Array<string | number>): string {
  // For SQLite, paths start with $ and use array notation [n] for numeric indices
  // and dot notation for string properties
  const pathElements = path
    .map((segment) =>
      typeof segment === 'number'
        ? `[${segment}]`
        : // In SQLite JSON_EXTRACT, keys with special characters should be in double quotes
          // For simplicity, we'll quote all string keys
          `.${JSON.stringify(segment)}`
    )
    .join('')

  return `$${pathElements}`
}

/**
 * A utility function that provides access to JSON fields in SQLite
 *
 * @param column The column storing the JSON object
 * @param path Path to the desired JSON property
 * @returns An SQL fragment that can be used in queries
 */
function jsonPath<T extends AnySQLiteColumn>(column: T, path: Array<string | number>): SQL<unknown> {
  if (path.length === 0) {
    return sql`${column}`
  }

  // Build the JSON path for extraction
  const jsonPath = buildJsonPathForExtract(path)

  // Use JSON_EXTRACT to get the value at the specified path
  return sql`JSON_EXTRACT(${column}, ${jsonPath})`
}

/**
 * Converts a WQL object to Drizzle SQLite where conditions
 */

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export function queryToDrizzleSqlite<Record extends BaseRecord<any, any, any> = BaseRecord>(
  query: Query<Record>,
  table: ReturnType<typeof sqliteTable<string, typeof sqliteBaseRecordTable>>
): SQL {
  // Handle empty WQL
  if (!query || Object.keys(query).length === 0) {
    return sql`1=1`
  }

  const conditions: Array<SQLWrapper> = []

  // Process $or operator
  if (query.$or && Array.isArray(query.$or) && query.$or.length > 0) {
    const _$or = query.$or as Query<BaseRecord>[]

    const orCondition = or(
      ..._$or.map((orItem) => queryToDrizzleSqlite(orItem, table)).filter((sql) => sql !== undefined)
    )
    if (orCondition) {
      conditions.push(orCondition)
    }
  }

  // Process $and operator
  if (query.$and && Array.isArray(query.$and) && query.$and.length > 0) {
    const _$and = query.$and as Query<BaseRecord>[]

    const andCondition = and(
      ..._$and.map((andItem) => queryToDrizzleSqlite(andItem, table)).filter((sql) => sql !== undefined)
    )
    if (andCondition) {
      conditions.push(andCondition)
    }
  }

  // Process $not operator
  if (query.$not) {
    const condition = queryToDrizzleSqlite(query.$not as Query<BaseRecord>, table)
    if (condition) {
      const notCondition = not(condition)
      if (notCondition) {
        conditions.push(notCondition)
      }
    }
  }

  // Process regular field conditions
  for (const field in query) {
    // Skip special operators we've already handled
    if (field === '$or' || field === '$and' || field === '$not') {
      continue
    }

    const value = query[field as keyof typeof query]

    // Check if the field exists in the table
    // In that case, query the column
    if (field in table && table[field as keyof typeof table] instanceof Object) {
      const column = table[field as keyof typeof table] as AnySQLiteColumn
      if (Array.isArray(value)) {
        conditions.push(arrayContainsAll(column, value))
      } else {
        conditions.push(eq(column, value))
      }
    } else {
      // Handle custom tag - assuming customTags is stored as a JSON string in SQLite
      if (Array.isArray(value)) {
        conditions.push(jsonArrayContainsAll(table.customTags, [field], value))
      } else {
        // For scalar values, we need to extract and compare in SQLite syntax
        conditions.push(eq(jsonPath(table.customTags, [field]), value))
      }
    }
  }

  // Combine all conditions with AND
  return conditions.length === 1 ? conditions[0].getSQL() : (and(...conditions) ?? sql`1=1`)
}
