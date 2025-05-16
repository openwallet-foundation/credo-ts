import { BaseRecord, Query } from '@credo-ts/core'
import { SQL, SQLWrapper, and, eq, not, or, sql } from 'drizzle-orm'
import { PgColumn, pgTable } from 'drizzle-orm/pg-core'
import { postgresBaseRecordTable } from '../postgres'

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
  return sql`${column} @> array[${sql.join(
    values.map((v) => sql`${v}`),
    sql`, `
  )}]`
}

/**
 * Checks if a JSONB array contains all values from a given array
 *
 * @param column The JSON/JSONB column to access
 * @param paths Path segments to the JSON array property
 * @param values Array of values to check for containment
 * @returns SQL condition that checks if all values are contained in the array
 */
function jsonArrayContainsAll<T extends PgColumn>(
  column: T,
  path: Array<string | number>,
  values: unknown[]
): SQL<unknown> {
  if (values.length === 0) {
    return sql`true` // Empty array always matches
  }

  // Build the path to the array
  let arrayPath: PgColumn | SQL = column
  for (const pathItem of path) {
    arrayPath = sql`${arrayPath}->'${pathItem}'`
  }

  // Create conditions for each value in the array
  const conditions = values.map((value) => {
    return sql`${arrayPath} @> ${sql`'[${sql.raw(JSON.stringify(value))}]'::jsonb`}`
  })

  // Combine all conditions with AND
  return sql.join(conditions, sql` AND `)
}

/**
 * A utility function that provides type-safe access to JSON/JSONB fields in PostgreSQL
 *
 * @param column The JSON/JSONB column to access
 * @param paths Path segments to the desired JSON property
 * @returns An SQL fragment that can be used in queries
 */
function jsonPath<T extends PgColumn>(column: T, path: Array<string | number>): SQL<unknown> {
  if (path.length === 0) {
    return sql`${column}`
  }

  // Start with the column reference
  let result = sql`${column}`

  // For all path segments except the last one, use the -> operator (returns JSON)
  for (let i = 0; i < path.length - 1; i++) {
    const pathItem = path[i]
    result = sql`${result}->'${pathItem}'`
  }

  // For the last path segment, use ->> operator (returns text)
  const lastPath = path[path.length - 1]
  result = sql`${result}->>'${lastPath}'`

  return result
}

/**
 * Converts a WQL object to Drizzle where conditions
 */

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export function queryToDrizzlePostgres<Record extends BaseRecord<any, any, any> = BaseRecord>(
  query: Query<Record>,
  table: ReturnType<typeof pgTable<string, typeof postgresBaseRecordTable>>
): SQL {
  // Handle empty WQL
  if (!query || Object.keys(query).length === 0) {
    return sql`true`
  }

  const conditions: Array<SQLWrapper> = []

  // Process $or operator
  if (query.$or && Array.isArray(query.$or) && query.$or.length > 0) {
    const _$or = query.$or as Query<BaseRecord>[]

    const orCondition = or(..._$or.map((or) => queryToDrizzlePostgres(or, table)).filter((sql) => sql !== undefined))
    if (orCondition) {
      conditions.push(orCondition)
    }
  }

  // Process $or operator
  if (query.$and && Array.isArray(query.$and) && query.$and.length > 0) {
    const _$and = query.$and as Query<BaseRecord>[]

    const andCondition = and(
      ..._$and.map((and) => queryToDrizzlePostgres(and, table)).filter((sql) => sql !== undefined)
    )
    if (andCondition) {
      conditions.push(andCondition)
    }
  }

  // Process $not operator - now supports both single object and array
  if (query.$not) {
    const condition = queryToDrizzlePostgres(query.$not as Query<BaseRecord>, table)
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
    if (field in table && table[field as keyof typeof table] instanceof PgColumn) {
      const column = table[field as keyof typeof table] as PgColumn
      if (Array.isArray(value)) {
        conditions.push(arrayContainsAll(column, value))
      } else {
        conditions.push(eq(column, value))
      }
    } else {
      // Handle custom tag
      if (Array.isArray(value)) {
        conditions.push(jsonArrayContainsAll(table.customTags, [field], value))
      } else {
        conditions.push(eq(jsonPath(table.customTags, [field]), value))
      }
    }
  }

  // Combine all conditions with AND
  return conditions.length === 1 ? conditions[0].getSQL() : (and(...conditions) ?? sql`true`)
}
