import type { BaseRecord, Query } from '@credo-ts/core'
import { PgDialect } from 'drizzle-orm/pg-core'
import { didcommConnection } from '../../didcomm/connection-record/postgres'
import { type DrizzleCustomTagKeyMapping, queryToDrizzlePostgres } from '../queryToDrizzlePostgres'

const dialect = new PgDialect()

function toQuery(query: Query<BaseRecord>, customTagKeyMapping?: DrizzleCustomTagKeyMapping) {
  const { sql, params } = dialect.sqlToQuery(queryToDrizzlePostgres(query, didcommConnection, customTagKeyMapping))
  return { sql, params }
}

describe('queryToDrizzlePostgres', () => {
  test('empty query', () => {
    expect(toQuery({})).toEqual({ sql: 'true', params: [] })
  })

  test('column equality', () => {
    expect(toQuery({ invitationDid: 'did' })).toEqual({
      sql: '"DidcommConnection"."invitation_did" = $1',
      params: ['did'],
    })
  })

  test('column array', () => {
    expect(toQuery({ connectionTypes: ['one', 'two'] })).toEqual({
      sql: '"DidcommConnection"."connection_types" @> $1',
      params: ['{"one","two"}'],
    })
  })

  test('custom tag equality compares the value with its json type', () => {
    expect(toQuery({ myTag: 'value' })).toEqual({
      sql: '"DidcommConnection"."custom_tags"->$1::text = $2::jsonb',
      params: ['myTag', '"value"'],
    })
    expect(toQuery({ myTag: true })).toEqual({
      sql: '"DidcommConnection"."custom_tags"->$1::text = $2::jsonb',
      params: ['myTag', 'true'],
    })
    expect(toQuery({ myTag: null })).toEqual({
      sql: '"DidcommConnection"."custom_tags"->$1::text = $2::jsonb',
      params: ['myTag', 'null'],
    })
  })

  test('custom tag array', () => {
    expect(toQuery({ myTag: ['a', 'b'] })).toEqual({
      sql: '"DidcommConnection"."custom_tags"->$1::text @> $2::jsonb',
      params: ['myTag', '["a","b"]'],
    })
    expect(toQuery({ myTag: [] })).toEqual({ sql: 'true', params: [] })
  })

  test('custom tag names and values are bound as parameters', () => {
    expect(toQuery({ "my'Tag": ["it's"] })).toEqual({
      sql: '"DidcommConnection"."custom_tags"->$1::text @> $2::jsonb',
      params: ["my'Tag", '["it\'s"]'],
    })
    expect(toQuery({ "my'Tag": "it's" })).toEqual({
      sql: '"DidcommConnection"."custom_tags"->$1::text = $2::jsonb',
      params: ["my'Tag", '"it\'s"'],
    })
  })

  test.each([
    "x']'::jsonb OR true --",
    "x' OR '1'='1",
    'x\'); DROP TABLE "DidcommConnection"; --',
    "x']'::jsonb; SELECT pg_sleep(10); --",
  ])('injection input %s only ends up in the params', (input) => {
    expect(toQuery({ myTag: [input] })).toEqual({
      sql: '"DidcommConnection"."custom_tags"->$1::text @> $2::jsonb',
      params: ['myTag', JSON.stringify([input])],
    })
    expect(toQuery({ myTag: input })).toEqual({
      sql: '"DidcommConnection"."custom_tags"->$1::text = $2::jsonb',
      params: ['myTag', JSON.stringify(input)],
    })
    expect(toQuery({ [input]: ['a'] })).toEqual({
      sql: '"DidcommConnection"."custom_tags"->$1::text @> $2::jsonb',
      params: [input, '["a"]'],
    })
    expect(toQuery({ [input]: 'a' })).toEqual({
      sql: '"DidcommConnection"."custom_tags"->$1::text = $2::jsonb',
      params: [input, '"a"'],
    })
    expect(toQuery({ connectionTypes: [input] })).toEqual({
      sql: '"DidcommConnection"."connection_types" @> $1',
      params: [`{"${input.replaceAll('"', '\\"')}"}`],
    })
  })

  test('custom tag key mapping', () => {
    expect(toQuery({ mappedTag: ['a'] }, { mappedTag: ['customTags', 'realTag'] })).toEqual({
      sql: '"DidcommConnection"."custom_tags"->$1::text @> $2::jsonb',
      params: ['realTag', '["a"]'],
    })
  })

  test('$or, $and and $not', () => {
    expect(toQuery({ $or: [{ myTag: 'a' }, { invitationDid: 'did' }] })).toEqual({
      sql: '("DidcommConnection"."custom_tags"->$1::text = $2::jsonb or "DidcommConnection"."invitation_did" = $3)',
      params: ['myTag', '"a"', 'did'],
    })
    expect(toQuery({ $and: [{ myTag: 'a' }, { invitationDid: 'did' }] })).toEqual({
      sql: '("DidcommConnection"."custom_tags"->$1::text = $2::jsonb and "DidcommConnection"."invitation_did" = $3)',
      params: ['myTag', '"a"', 'did'],
    })
    expect(toQuery({ $not: { myTag: 'a', invitationDid: 'did' } })).toEqual({
      sql: '(not "DidcommConnection"."custom_tags"->$1::text = $2::jsonb and not "DidcommConnection"."invitation_did" = $3)',
      params: ['myTag', '"a"', 'did'],
    })
  })
})
