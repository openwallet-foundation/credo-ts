import { BaseRecord, Query, TagValue } from '@credo-ts/core'
import { SQL, SQLWrapper, and, eq, not, or, sql } from 'drizzle-orm'
import { PgColumn, pgTable } from 'drizzle-orm/pg-core'
import { CredoDrizzleStorageError } from '../error'
import { getPostgresBaseRecordTable } from '../postgres'

// We only support one layer of nesting at the moment for mapped keys
export type DrizzleCustomTagKeyMapping = Record<string, readonly [string, string]>

/**
 * Checks if a PostgreSQL array column contains all values from the given array
 *
 * @param column The array column to check
 * @param values Array of values that should be contained in the column
 * @returns SQL condition that checks if all values are in the array column
 */
function arrayContainsAll<T extends PgColumn>(column: T, values: unknown[]): SQL<unknown> {
  if (values.length === 0) {
    return sql`true` // Empty array always matches
  }

  // Instead of manually formatting, let Drizzle handle the parameter binding
  // We create an array literal in PostgreSQL syntax and bind the values safely
  return sql`to_jsonb(${column}) @> to_jsonb(array[${sql.join(
    values.map((v) => sql`${v}`),
    sql`, `
  )}])`
}

/**
 * Checks if a JSONB array contains all values from a given array
 *
 * @param column The JSON/JSONB column to access
 * @param paths Path segments to the JSON array property
 * @param values Array of values to check for containment
 * @returns SQL condition that checks if all values are contained in the array
 */
function jsonArrayContainsAll<T extends PgColumn>(column: T, field: string, values: unknown[]): SQL<unknown> {
  if (values.length === 0) {
    return sql`true` // Empty array always matches
  }

  const path = sql`to_jsonb(${column})->'${sql.raw(field)}'`

  // Create conditions for each value in the array
  const conditions = values.map((value) => {
    return sql`${path} @> ${sql`'[${sql.raw(JSON.stringify(value))}]'::jsonb`}`
  })

  // Combine all conditions with AND
  return sql.join(conditions, sql` AND `)
}

function jsonEqual<T extends PgColumn>(column: T, field: string, value: TagValue) {
  const valueType = typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'numeric' : 'text'
  return sql`(${column} ->> '${sql.raw(field)}')::${sql.raw(valueType)} = ${value}`
}

/**
 * Converts a WQL object to Drizzle where conditions
 */

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export function queryToDrizzlePostgres<CredoRecord extends BaseRecord<any, any, any> = BaseRecord>(
  query: Query<CredoRecord>,
  table: ReturnType<typeof pgTable<string, ReturnType<typeof getPostgresBaseRecordTable>>>,
  customTagKeyMapping?: DrizzleCustomTagKeyMapping
): SQL {
  // Handle empty WQL
  if (!query || Object.keys(query).length === 0) {
    return sql`true`
  }

  const conditions: Array<SQLWrapper> = []

  // Process $or operator
  if (query.$or && Array.isArray(query.$or) && query.$or.length > 0) {
    const _$or = query.$or as Query<BaseRecord>[]

    const orCondition = or(
      ..._$or.map((or) => queryToDrizzlePostgres(or, table, customTagKeyMapping)).filter((sql) => sql !== undefined)
    )
    if (orCondition) {
      conditions.push(orCondition)
    }
  }

  // Process $and operator
  if (query.$and && Array.isArray(query.$and) && query.$and.length > 0) {
    const _$and = query.$and as Query<BaseRecord>[]

    const andCondition = and(
      ..._$and.map((and) => queryToDrizzlePostgres(and, table, customTagKeyMapping)).filter((sql) => sql !== undefined)
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
          const condition = queryToDrizzlePostgres(andItem, table, customTagKeyMapping)
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
        ..._$or.map((orItem) => queryToDrizzlePostgres(orItem, table, customTagKeyMapping)).filter(Boolean)
      )

      if (orCondition) {
        notConditions.push(not(orCondition))
      }
    }

    // Process other fields in $not
    for (const field in notQuery) {
      if (field === '$not') {
        throw new Error('Nested $not in $not is not supported')
      }

      if (field === '$or' || field === '$and') {
        continue
      }

      const condition = queryToDrizzlePostgres(
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
    if (field in table && table[field as keyof typeof table] instanceof PgColumn) {
      const column = table[field as keyof typeof table] as PgColumn
      if (Array.isArray(value)) {
        conditions.push(arrayContainsAll(column, value))
      } else {
        conditions.push(eq(column, value))
      }
    } else {
      // Check if field has a custom mapping
      let targetField = field
      let targetColumn: PgColumn = table.customTags

      if (customTagKeyMapping && field in customTagKeyMapping) {
        const mapping = customTagKeyMapping[field]
        const [columnName, fieldName] = mapping

        // Check if the mapped column exists in the table
        if (columnName in table && table[columnName as keyof typeof table] instanceof PgColumn) {
          targetColumn = table[columnName as keyof typeof table] as PgColumn
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
        conditions.push(jsonEqual(targetColumn, targetField, value as TagValue))
      }
    }
  }

  // Combine all conditions with AND
  return conditions.length === 1 ? conditions[0].getSQL() : (and(...conditions) ?? sql`true`)
}
