import { DidCommConnectionRecord, DidCommDidExchangeRole, DidCommDidExchangeState } from '@credo-ts/didcomm'
import { pushSchema } from 'drizzle-kit/api'
import { createDrizzlePostgresTestDatabase, type DrizzlePostgresTestDatabase } from '../../../tests/testDatabase'
import * as coreContextSchema from '../../core/context-record/postgres'
import * as didcommConnectionSchema from '../../didcomm/connection-record/postgres'
import { queryToDrizzlePostgres } from '../queryToDrizzlePostgres'

const { didcommConnection } = didcommConnectionSchema
const { context } = coreContextSchema

describe('queryToDrizzlePostgres', () => {
  let postgresDatabase: DrizzlePostgresTestDatabase

  beforeAll(async () => {
    postgresDatabase = await createDrizzlePostgresTestDatabase()

    const { apply } = await pushSchema(
      { ...didcommConnectionSchema, ...coreContextSchema },
      // @ts-expect-error
      postgresDatabase.drizzle
    )
    await apply()

    await postgresDatabase.drizzle.insert(context).values({
      contextCorrelationId: 'b2fc0867-d0d1-4182-ade7-813b695d43c2',
    })
    await postgresDatabase.drizzle.insert(didcommConnection).values({
      createdAt: new Date(),
      updatedAt: new Date(),
      contextCorrelationId: 'b2fc0867-d0d1-4182-ade7-813b695d43c2',
      id: 'db0ddc8f-5339-431b-9675-749f8a2ac92f',
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

  afterAll(async () => {
    await postgresDatabase.teardown()
  })

  test('should correctly query column', async () => {
    expect(
      await postgresDatabase.drizzle
        .select()
        .from(didcommConnection)
        .where(
          queryToDrizzlePostgres<DidCommConnectionRecord>(
            {
              invitationDid: 'some string',
            },
            didcommConnection
          )
        )
    ).toHaveLength(1)

    expect(
      await postgresDatabase.drizzle
        .select()
        .from(didcommConnection)
        .where(
          queryToDrizzlePostgres<DidCommConnectionRecord>(
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
      await postgresDatabase.drizzle
        .select()
        .from(didcommConnection)
        .where(
          queryToDrizzlePostgres<DidCommConnectionRecord>(
            {
              connectionTypes: ['one', 'three'],
              invitationDid: 'some string',
            },
            didcommConnection
          )
        )
    ).toHaveLength(1)

    expect(
      await postgresDatabase.drizzle
        .select()
        .from(didcommConnection)
        .where(
          queryToDrizzlePostgres<DidCommConnectionRecord>(
            {
              connectionTypes: ['one', 'two', 'five'],
              invitationDid: 'some string',
            },
            didcommConnection
          )
        )
    ).toHaveLength(0)

    expect(
      await postgresDatabase.drizzle
        .select()
        .from(didcommConnection)
        .where(
          queryToDrizzlePostgres<DidCommConnectionRecord>(
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
      await postgresDatabase.drizzle
        .select()
        .from(didcommConnection)
        .where(
          queryToDrizzlePostgres<DidCommConnectionRecord>(
            {
              anotherCustomTag: true,
              invitationDid: 'some string',
            },
            didcommConnection
          )
        )
    ).toHaveLength(1)

    expect(
      await postgresDatabase.drizzle
        .select()
        .from(didcommConnection)
        .where(
          queryToDrizzlePostgres<DidCommConnectionRecord>(
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
      await postgresDatabase.drizzle
        .select()
        .from(didcommConnection)
        .where(
          queryToDrizzlePostgres<DidCommConnectionRecord>(
            {
              myCustomTag: ['First', 'Second'],
              invitationDid: 'some string',
            },
            didcommConnection
          )
        )
    ).toHaveLength(1)

    expect(
      await postgresDatabase.drizzle
        .select()
        .from(didcommConnection)
        .where(
          queryToDrizzlePostgres<DidCommConnectionRecord>(
            {
              myCustomTag: ['Third'],
              invitationDid: 'some string',
            },
            didcommConnection
          )
        )
    ).toHaveLength(0)

    expect(
      await postgresDatabase.drizzle
        .select()
        .from(didcommConnection)
        .where(
          queryToDrizzlePostgres<DidCommConnectionRecord>(
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
      await postgresDatabase.drizzle
        .select()
        .from(didcommConnection)
        .where(
          queryToDrizzlePostgres<DidCommConnectionRecord>(
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
      await postgresDatabase.drizzle
        .select()
        .from(didcommConnection)
        .where(
          queryToDrizzlePostgres<DidCommConnectionRecord>(
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
      await postgresDatabase.drizzle
        .select()
        .from(didcommConnection)
        .where(
          queryToDrizzlePostgres<DidCommConnectionRecord>(
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
      await postgresDatabase.drizzle
        .select()
        .from(didcommConnection)
        .where(
          queryToDrizzlePostgres<DidCommConnectionRecord>(
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
