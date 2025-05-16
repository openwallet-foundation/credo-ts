import { ConnectionRecord, DidExchangeRole, DidExchangeState } from '@credo-ts/didcomm'
import { pushSchema } from 'drizzle-kit/api'
import { PgDatabase } from 'drizzle-orm/pg-core'
import { drizzle } from 'drizzle-orm/pglite'
import { DrizzlePostgresDatabase } from '../../DrizzleDatabase'
import * as didcommConnectionSchema from '../../didcomm/connection/postgres'
import { queryToDrizzlePostgres } from '../queryToDrizzlePostgres'

const { didcommConnection } = didcommConnectionSchema

const db = drizzle('memory://', {
  schema: didcommConnectionSchema,
}) as unknown as DrizzlePostgresDatabase<typeof didcommConnectionSchema>

describe('queryToDrizzlePostgres', () => {
  beforeAll(async () => {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    const { apply } = await pushSchema(didcommConnectionSchema, db as unknown as PgDatabase<any>)
    await apply()

    await db.insert(didcommConnection).values({
      id: 'db0ddc8f-5339-431b-9675-749f8a2ac92f',
      role: DidExchangeRole.Requester,
      state: DidExchangeState.Abandoned,
      connectionTypes: ['one', 'three', 'four'],
      invitationDid: 'some string',
      customTags: {
        myCustomTag: ['First', 'Second'],
        anotherCustomTag: true,
      },
    })
  })

  test('should correctly query column', async () => {
    expect(
      await db
        .select()
        .from(didcommConnection)
        .where(
          queryToDrizzlePostgres<ConnectionRecord>(
            {
              invitationDid: 'some string',
            },
            didcommConnection
          )
        )
    ).toHaveLength(1)

    expect(
      await db
        .select()
        .from(didcommConnection)
        .where(
          queryToDrizzlePostgres<ConnectionRecord>(
            {
              invitationDid: 'some other string',
            },
            didcommConnection
          )
        )
    ).toHaveLength(0)
  })

  test('should correctly query array value column', async () => {
    expect(
      await db
        .select()
        .from(didcommConnection)
        .where(
          queryToDrizzlePostgres<ConnectionRecord>(
            {
              connectionTypes: ['one', 'three'],
              invitationDid: 'some string',
            },
            didcommConnection
          )
        )
    ).toHaveLength(1)

    expect(
      await db
        .select()
        .from(didcommConnection)
        .where(
          queryToDrizzlePostgres<ConnectionRecord>(
            {
              connectionTypes: ['one', 'two', 'five'],
              invitationDid: 'some string',
            },
            didcommConnection
          )
        )
    ).toHaveLength(0)

    expect(
      await db
        .select()
        .from(didcommConnection)
        .where(
          queryToDrizzlePostgres<ConnectionRecord>(
            {
              connectionTypes: ['one'],
              invitationDid: 'some string',
            },
            didcommConnection
          )
        )
    ).toHaveLength(1)
  })

  test('should correctly query custom tag column value', async () => {
    expect(
      await db
        .select()
        .from(didcommConnection)
        .where(
          queryToDrizzlePostgres<ConnectionRecord>(
            {
              anotherCustomTag: true,
              invitationDid: 'some string',
            },
            didcommConnection
          )
        )
    ).toHaveLength(1)

    expect(
      await db
        .select()
        .from(didcommConnection)
        .where(
          queryToDrizzlePostgres<ConnectionRecord>(
            {
              anotherCustomTag: false,
              invitationDid: 'some string',
            },
            didcommConnection
          )
        )
    ).toHaveLength(0)
  })

  test('should correctly query custom tag column array value', async () => {
    expect(
      await db
        .select()
        .from(didcommConnection)
        .where(
          queryToDrizzlePostgres<ConnectionRecord>(
            {
              myCustomTag: ['First', 'Second'],
              invitationDid: 'some string',
            },
            didcommConnection
          )
        )
    ).toHaveLength(1)

    expect(
      await db
        .select()
        .from(didcommConnection)
        .where(
          queryToDrizzlePostgres<ConnectionRecord>(
            {
              myCustomTag: ['Third'],
              invitationDid: 'some string',
            },
            didcommConnection
          )
        )
    ).toHaveLength(0)

    expect(
      await db
        .select()
        .from(didcommConnection)
        .where(
          queryToDrizzlePostgres<ConnectionRecord>(
            {
              myCustomTag: ['First'],
              invitationDid: 'some string',
            },
            didcommConnection
          )
        )
    ).toHaveLength(1)
  })

  test('should correctly query with and/or', async () => {
    expect(
      await db
        .select()
        .from(didcommConnection)
        .where(
          queryToDrizzlePostgres<ConnectionRecord>(
            {
              connectionTypes: ['one'],
              $or: [
                {
                  connectionTypes: ['two'],
                },
                {
                  connectionTypes: ['three'],
                },
              ],
              $and: [
                {
                  connectionTypes: ['four'],
                },
              ],
            },
            didcommConnection
          )
        )
    ).toHaveLength(1)

    expect(
      await db
        .select()
        .from(didcommConnection)
        .where(
          queryToDrizzlePostgres<ConnectionRecord>(
            {
              connectionTypes: ['one'],
              $or: [
                {
                  connectionTypes: ['two'],
                },
                {
                  connectionTypes: ['three'],
                },
              ],
              $and: [
                {
                  connectionTypes: ['four'],
                },
                {
                  connectionTypes: ['two'],
                },
              ],
            },
            didcommConnection
          )
        )
    ).toHaveLength(0)
  })

  test('should correctly query with not', async () => {
    expect(
      await db
        .select()
        .from(didcommConnection)
        .where(
          queryToDrizzlePostgres<ConnectionRecord>(
            {
              connectionTypes: ['one'],
              $not: {
                $and: [
                  {
                    connectionTypes: ['two'],
                  },
                  {
                    connectionTypes: ['five'],
                  },
                ],
                $or: [
                  {
                    connectionTypes: ['two'],
                  },
                  {
                    connectionTypes: ['three'],
                  },
                ],
              },
            },
            didcommConnection
          )
        )
    ).toHaveLength(1)

    expect(
      await db
        .select()
        .from(didcommConnection)
        .where(
          queryToDrizzlePostgres<ConnectionRecord>(
            {
              connectionTypes: ['one'],
              $not: {
                $and: [
                  {
                    connectionTypes: ['two'],
                  },
                  {
                    connectionTypes: ['five'],
                  },
                  {
                    connectionTypes: ['three'],
                  },
                ],
                $or: [
                  {
                    connectionTypes: ['two'],
                  },
                  {
                    connectionTypes: ['three'],
                  },
                ],
              },
            },
            didcommConnection
          )
        )
    ).toHaveLength(0)
  })
})
