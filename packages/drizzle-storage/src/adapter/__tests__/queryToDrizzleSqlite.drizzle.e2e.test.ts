import { DidCommConnectionRecord, DidCommDidExchangeRole, DidCommDidExchangeState } from '@credo-ts/didcomm'
import { pushSQLiteSchema } from 'drizzle-kit/api'
import { drizzle } from 'drizzle-orm/libsql'
import { DrizzleSqliteDatabase } from '../../DrizzleDatabase'
import * as coreContextSchema from '../../core/context-record/sqlite'
import * as didcommConnectionSchema from '../../didcomm/connection-record/sqlite'
import { queryToDrizzleSqlite } from '../queryToDrizzleSqlite'

const { context } = coreContextSchema
const { didcommConnection } = didcommConnectionSchema

const db = drizzle(':memory:', {
  schema: { ...didcommConnectionSchema, ...coreContextSchema },
}) as unknown as DrizzleSqliteDatabase<typeof didcommConnectionSchema>

describe('queryToDrizzleSqlite', () => {
  beforeAll(async () => {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    const { apply } = await pushSQLiteSchema({ ...didcommConnectionSchema, ...coreContextSchema }, db as any)
    await apply()

    await db.insert(context).values({
      contextCorrelationId: 'something',
    })
    await db.insert(didcommConnection).values({
      contextCorrelationId: 'something',
      createdAt: new Date(),
      updatedAt: new Date(),
      id: 'something',
      role: DidCommDidExchangeRole.Requester,
      state: DidCommDidExchangeState.Abandoned,
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
          queryToDrizzleSqlite<DidCommConnectionRecord>(
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
          queryToDrizzleSqlite<DidCommConnectionRecord>(
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
          queryToDrizzleSqlite<DidCommConnectionRecord>(
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
          queryToDrizzleSqlite<DidCommConnectionRecord>(
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
          queryToDrizzleSqlite<DidCommConnectionRecord>(
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
          queryToDrizzleSqlite<DidCommConnectionRecord>(
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
          queryToDrizzleSqlite<DidCommConnectionRecord>(
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
          queryToDrizzleSqlite<DidCommConnectionRecord>(
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
          queryToDrizzleSqlite<DidCommConnectionRecord>(
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
          queryToDrizzleSqlite<DidCommConnectionRecord>(
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
          queryToDrizzleSqlite<DidCommConnectionRecord>(
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
          queryToDrizzleSqlite<DidCommConnectionRecord>(
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
          queryToDrizzleSqlite<DidCommConnectionRecord>(
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
          queryToDrizzleSqlite<DidCommConnectionRecord>(
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
