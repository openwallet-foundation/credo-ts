import { cli } from '../packages/drizzle-storage/cli/cli-definition'
import { createDrizzlePostgresTestDatabase } from '../packages/drizzle-storage/tests/testDatabase'

describe('Credo Drizzle CLI', () => {
  test('generate migrations', async () => {
    await cli.route([
      '--silent',
      '--bundle',
      'core',
      '--bundle',
      'didcomm',
      '--bundle',
      'anoncreds',
      '--bundle',
      'action-menu',
      '--bundle',
      'question-answer',
      '--bundle',
      'drpc',
      '--bundle',
      'tenants',
      '--bundle',
      'openid4vc',
      'generate',
    ])
  })

  test('migrate postgres', async () => {
    const postgresDatabase = await createDrizzlePostgresTestDatabase()

    try {
      await cli.route([
        '--silent',
        '--bundle',
        'core',
        '--bundle',
        'didcomm',
        '--bundle',
        'anoncreds',
        '--bundle',
        'action-menu',
        '--bundle',
        'question-answer',
        '--bundle',
        'drpc',
        '--bundle',
        'tenants',
        '--bundle',
        'openid4vc',
        'migrate',
        '--dialect',
        'postgres',
        '--database-url',
        postgresDatabase.drizzleConnectionString,
      ])
    } finally {
      await postgresDatabase?.teardown()
    }
  })

  test('migrate sqlite', async () => {
    await cli.route([
      '--silent',
      '--bundle',
      'core',
      '--bundle',
      'didcomm',
      '--bundle',
      'anoncreds',
      '--bundle',
      'action-menu',
      '--bundle',
      'question-answer',
      '--bundle',
      'drpc',
      '--bundle',
      'tenants',
      '--bundle',
      'openid4vc',
      'migrate',
      '--dialect',
      'sqlite',
      '--database-url',
      ':memory:',
    ])
  })
})
