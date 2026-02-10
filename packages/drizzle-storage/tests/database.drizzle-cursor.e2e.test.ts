import { Agent, recordToCursor, utils } from '@credo-ts/core'
import { agentDependencies } from '@credo-ts/node'
import { DrizzleStorageModule } from '../src'
import { actionMenuBundle } from '../src/action-menu/bundle'
import { anoncredsBundle } from '../src/anoncreds/bundle'
import { coreBundle } from '../src/core/bundle'
import { didcommBundle } from '../src/didcomm/bundle'
import {
  createDrizzlePostgresTestDatabase,
  type DrizzlePostgresTestDatabase,
  inMemoryDrizzleSqliteDatabase,
  pushDrizzleSchema,
} from './testDatabase'

describe.each(['postgres', 'sqlite'] as const)('Drizzle storage with %s', (type) => {
  let agent: Agent
  let postgresDatabase: DrizzlePostgresTestDatabase | undefined
  const recordId1 = utils.uuid()
  const recordId2 = utils.uuid()
  const recordId3 = utils.uuid()
  const recordId4 = utils.uuid()

  beforeAll(async () => {
    if (type === 'postgres') {
      postgresDatabase = await createDrizzlePostgresTestDatabase()
    }

    const drizzleModule = new DrizzleStorageModule({
      database: postgresDatabase?.drizzle ?? (await inMemoryDrizzleSqliteDatabase()),
      bundles: [coreBundle, didcommBundle, actionMenuBundle, anoncredsBundle],
    })

    agent = new Agent({
      dependencies: agentDependencies,
      modules: {
        storage: drizzleModule,
      },
    })

    await pushDrizzleSchema(drizzleModule)
    await agent.initialize()

    await Promise.all([
      agent.genericRecords.save({
        content: {
          hey: 'there 1',
        },
        id: recordId1,
        tags: {
          something: 'cool',
        },
      }),
      agent.genericRecords.save({
        content: {
          hey: 'there 2',
        },
        id: recordId2,
        tags: {
          something: 'cool',
        },
      }),
      agent.genericRecords.save({
        content: {
          hey: 'there 3',
        },
        id: recordId3,
        tags: {
          something: 'cool',
        },
      }),
      agent.genericRecords.save({
        content: {
          hey: 'there 4',
        },
        id: recordId4,
        tags: {
          something: 'cool',
        },
      }),
    ])
  })

  afterAll(async () => {
    await postgresDatabase?.teardown()
  })

  test('cursor pagination: fetch next page using after cursor', async () => {
    const firstPage = await agent.genericRecords.findAllByQuery({ something: 'cool' }, { limit: 2 })

    expect(firstPage).toHaveLength(2)

    const afterCursor = recordToCursor({
      ...firstPage[firstPage.length - 1],
      createdAt: firstPage[firstPage.length - 1].createdAt.toISOString(),
    })

    const secondPage = await agent.genericRecords.findAllByQuery(
      { something: 'cool' },
      {
        limit: 2,
        cursor: {
          after: afterCursor,
        },
      }
    )

    expect(secondPage).toHaveLength(2)

    // Ensure no overlap
    const firstIds = firstPage.map((r) => r.id)
    const secondIds = secondPage.map((r) => r.id)

    expect(secondIds.some((id) => firstIds.includes(id))).toBe(false)
  })

  test('cursor pagination: fetch previous page using before cursor', async () => {
    const allRecords = await agent.genericRecords.findAllByQuery({ something: 'cool' }, { limit: 4 })

    expect(allRecords).toHaveLength(4)

    const beforeCursor = recordToCursor(allRecords[allRecords.length - 1])

    const previousPage = await agent.genericRecords.findAllByQuery(
      { something: 'cool' },
      {
        limit: 2,
        cursor: {
          before: beforeCursor,
        },
      }
    )

    expect(previousPage).toHaveLength(2)
  })

  test('cursor pagination: supports windowed pagination using after and before', async () => {
    const all = await agent.genericRecords.findAllByQuery({ something: 'cool' }, { limit: 4 })

    const after = recordToCursor(all[0])
    const before = recordToCursor(all[all.length - 1])

    const window = await agent.genericRecords.findAllByQuery(
      { something: 'cool' },
      {
        limit: 2,
        cursor: {
          after,
          before,
        },
      }
    )

    expect(window.length).toBeLessThanOrEqual(2)

    const allIds = all.map((r) => r.id)
    window.forEach((record) => {
      expect(allIds).toContain(record.id)
    })
  })

  test('cursor pagination: results are strictly ordered by createdAt + id', async () => {
    const page = await agent.genericRecords.findAllByQuery(
      { something: 'cool' },
      { limit: 3 }
    )

    for (let i = 1; i < page.length; i++) {
      const prev = page[i - 1]
      const curr = page[i]

      const prevDate = new Date(prev.createdAt)
      const currDate = new Date(curr.createdAt)

      expect(
        prevDate > currDate ||
        (prevDate.getTime() === currDate.getTime() && prev.id < curr.id)
      ).toBe(true)
    }
  })


  test('cursor pagination: invalid cursor returns empty result', async () => {
    const result = await agent.genericRecords.findAllByQuery(
      { something: 'cool' },
      {
        limit: 2,
        cursor: {
          after: 'not-a-valid-cursor',
        },
      }
    )

    expect(result).toEqual([])
  })

  test('cursor pagination: cursor takes precedence over offset', async () => {
    const firstPage = await agent.genericRecords.findAllByQuery({ something: 'cool' }, { limit: 2 })

    const cursor = recordToCursor(firstPage[firstPage.length - 1])

    const result = await agent.genericRecords.findAllByQuery(
      { something: 'cool' },
      {
        limit: 2,
        offset: 10,
        cursor: {
          after: cursor,
        },
      }
    )

    expect(result.length).toBeGreaterThan(0)
  })

  test('cursor pagination: deleted records do not break cursor paging', async () => {
    const page = await agent.genericRecords.findAllByQuery({ something: 'cool' }, { limit: 2 })

    await agent.genericRecords.deleteById(page[0].id)

    const cursor = recordToCursor(page[page.length - 1])

    const nextPage = await agent.genericRecords.findAllByQuery(
      { something: 'cool' },
      {
        limit: 2,
        cursor: {
          after: cursor,
        },
      }
    )

    expect(nextPage.every((r) => r.id !== page[0].id)).toBe(true)
  })

  test('cursor pagination: results are strictly ordered by createdAt (DESC) + id (ASC)', async () => {
    const page = await agent.genericRecords.findAllByQuery({ something: 'cool' }, { limit: 4 })

    for (let i = 1; i < page.length; i++) {
      const prev = page[i - 1]
      const curr = page[i]

      const prevDate = new Date(prev.createdAt).getTime()
      const currDate = new Date(curr.createdAt).getTime()

      if (prevDate === currDate) {
        // If timestamps match, ID must be ascending (A < B)
        expect(prev.id.localeCompare(curr.id)).toBe(-1)
      } else {
        // Otherwise, date must be descending (Newer > Older)
        expect(prevDate).toBeGreaterThan(currDate)
      }
    }
  })

  test('cursor pagination: returns empty array when no records match query with cursor', async () => {
    const result = await agent.genericRecords.findAllByQuery(
      { something: 'non-existent-tag' },
      {
        limit: 2,
        cursor: { after: recordToCursor({ id: 'any', createdAt: new Date() }) },
      }
    )

    expect(result).toEqual([])
  })

  test('cursor pagination: preserves stable sort order when timestamps are identical (tie-breaker)', async () => {
    const groupTag = utils.uuid() // Unique group for this test
    const idA = '00000000-0000-0000-0000-00000000000a'
    const idB = '00000000-0000-0000-0000-00000000000b'

    await agent.genericRecords.save({
      content: { name: 'Record A' },
      id: idA,
      tags: { group: groupTag },
    } as any)

    await agent.genericRecords.save({
      content: { name: 'Record B' },
      id: idB,
      tags: { group: groupTag },
    } as any)

    // 1. Get the forward page to see what the DB decided the order is
    const forwardPage = await agent.genericRecords.findAllByQuery({ group: groupTag }, { limit: 2 })

    expect(forwardPage).toHaveLength(2)

    // 2. Take the SECOND record's cursor
    const firstRecord = forwardPage[0]
    const secondRecord = forwardPage[1]
    const cursorForSecond = recordToCursor(secondRecord)

    // 3. Fetch "Backward" from the second record
    const backwardPage = await agent.genericRecords.findAllByQuery(
      { group: groupTag },
      {
        limit: 1,
        cursor: {
          before: cursorForSecond,
        },
      }
    )

    // 4. It should ALWAYS return the first record,
    // regardless of whether the DB sorted by Time or ID tie-breaker.
    expect(backwardPage).toHaveLength(1)
    expect(backwardPage[0].id).toBe(firstRecord.id)
  })
})
