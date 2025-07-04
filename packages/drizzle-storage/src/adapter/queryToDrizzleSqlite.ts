import { BaseRecord, Query } from '@credo-ts/core'
import { SQL, SQLWrapper, and, eq, not, or, sql } from 'drizzle-orm'
import { sqliteTable } from 'drizzle-orm/sqlite-core'
import type { AnySQLiteColumn, SQLiteColumn } from 'drizzle-orm/sqlite-core'
import { CredoDrizzleStorageError } from '../error'
import { getSqliteBaseRecordTable } from '../sqlite'
import { DrizzleCustomTagKeyMapping } from './queryToDrizzlePostgres'

/**
 * Checks if an array column (stored as JSON text in SQLite) contains all values from the given array
 * This ensures that the provided values array is a subset of the stored array
 *
 * @param column The column storing the JSON array
 * @param values Array of values that should be contained in the column
 * @returns SQL condition that checks if all values are in the array
 */
function arrayContainsAll<T extends AnySQLiteColumn>(column: T, values: unknown[]): SQL<unknown> {
  if (values.length === 0) {
    return sql`1=1` // Empty array always matches
  }

  return sql.join(
    values.map((value) => sql`EXISTS (SELECT 1 FROM json_each(${column}) WHERE value = ${value})`),
    sql` AND `
  )
}

/**
 * Checks if a JSON array within a JSON object contains all values from a given array
 *
 * @param column The column storing the JSON object
 * @param path Path to the JSON array property
 * @param values Array of values to check for containment
 * @returns SQL condition that checks if all values are contained in the array
 */
function jsonArrayContainsAll<T extends AnySQLiteColumn>(column: T, tag: string, values: unknown[]): SQL<unknown> {
  if (values.length === 0) {
    return sql`1=1` // Empty array always matches
  }

  const jsonPath = `$."${tag}"`
  return sql.join(
    values.map(
      (value) => sql`EXISTS (SELECT 1 FROM json_each(json_extract(${column}, ${jsonPath})) WHERE value = ${value})`
    ),
    sql` AND `
  )
}
/**
 * Converts a WQL object to Drizzle SQLite where conditions
 */

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export function queryToDrizzleSqlite<CredoRecord extends BaseRecord<any, any, any> = BaseRecord>(
  query: Query<CredoRecord>,
  table: ReturnType<typeof sqliteTable<string, ReturnType<typeof getSqliteBaseRecordTable>>>,
  customTagKeyMapping?: DrizzleCustomTagKeyMapping
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
      ..._$or
        .map((orItem) => queryToDrizzleSqlite(orItem, table, customTagKeyMapping))
        .filter((sql) => sql !== undefined)
    )
    if (orCondition) {
      conditions.push(orCondition)
    }
  }

  // Process $and operator
  if (query.$and && Array.isArray(query.$and) && query.$and.length > 0) {
    const _$and = query.$and as Query<BaseRecord>[]

    const andCondition = and(
      ..._$and
        .map((andItem) => queryToDrizzleSqlite(andItem, table, customTagKeyMapping))
        .filter((sql) => sql !== undefined)
    )
    if (andCondition) {
      conditions.push(andCondition)
    }
  }

  // Process $not operator
  if (query.$not) {
    const notQuery = query.$not as Query<BaseRecord>
    const notConditions: Array<SQLWrapper> = []

    // Process $and within $not - all statements must be false
    if (notQuery.$and && Array.isArray(notQuery.$and) && notQuery.$and.length > 0) {
      const _$and = notQuery.$and as Query<BaseRecord>[]

      // We need NOT(condition1 OR condition2 OR condition3)
      // This is equivalent to NOT(condition1) AND NOT(condition2) AND NOT(condition3)
      const andNotConditions = _$and
        .map((andItem) => {
          const condition = queryToDrizzleSqlite(andItem, table, customTagKeyMapping)
          return condition ? not(condition) : undefined
        })
        .filter((condition) => condition !== undefined)

      const andCondition = and(...andNotConditions)
      if (andCondition) {
        notConditions.push(andCondition)
      }
    }

    // Process $or within $not - at least one statement must be false
    if (notQuery.$or && Array.isArray(notQuery.$or) && notQuery.$or.length > 0) {
      const _$or = notQuery.$or as Query<BaseRecord>[]

      // We need at least one false, so NOT(condition1 AND condition2 AND condition3)
      const orCondition = and(
        ..._$or.map((orItem) => queryToDrizzleSqlite(orItem, table, customTagKeyMapping)).filter(Boolean)
      )

      if (orCondition) {
        notConditions.push(not(orCondition))
      }
    }

    // Process other fields in $not
    for (const field in notQuery) {
      if (field === '$not') {
        throw new CredoDrizzleStorageError('Nested $not in $not is not supported')
      }

      if (field === '$or' || field === '$and') {
        continue
      }

      const condition = queryToDrizzleSqlite(
        { [field]: notQuery[field as keyof typeof notQuery] } as Query<BaseRecord>,
        table,
        customTagKeyMapping
      )
      if (condition) {
        notConditions.push(not(condition))
      }
    }

    // Combine all $not conditions with AND
    const combinedNotCondition = notConditions.length === 1 ? notConditions[0] : and(...notConditions)
    if (combinedNotCondition) {
      conditions.push(combinedNotCondition)
    }
  }

  // Process regular field conditions
  for (const field in query) {
    // Skip special operators we've already handled
    if (field === '$or' || field === '$and' || field === '$not') {
      continue
    }

    const value = query[field as keyof typeof query]

    // Skip undefined values
    if (value === undefined) continue

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
      // Check if field has a custom mapping
      let targetField = field
      let targetColumn: SQLiteColumn = table.customTags

      if (customTagKeyMapping && field in customTagKeyMapping) {
        const mapping = customTagKeyMapping[field]
        const [columnName, fieldName] = mapping

        if (columnName in table && table[columnName as keyof typeof table] instanceof Object) {
          // Check if the mapped column exists in the table
          targetColumn = table[columnName as keyof typeof table] as AnySQLiteColumn
          targetField = fieldName
        } else {
          throw new CredoDrizzleStorageError(
            `Query defined custom mapping from key '${field}' to column ${columnName}, but the column does not exist in the table.`
          )
        }
      }

      // Handle custom tag or mapped field
      if (Array.isArray(value)) {
        conditions.push(jsonArrayContainsAll(targetColumn, targetField, value))
      } else {
        const jsonPath = `$."${targetField}"`
        // For scalar values, we need to extract and compare in SQLite syntax
        conditions.push(eq(sql`json_extract(${targetColumn}, ${jsonPath})`, value))
      }
    }
  }

  // Combine all conditions with AND
  return conditions.length === 1 ? conditions[0].getSQL() : (and(...conditions) ?? sql`1=1`)
}
