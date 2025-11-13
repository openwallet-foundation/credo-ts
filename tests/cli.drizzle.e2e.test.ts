import { cli } from '../packages/drizzle-storage/cli/cli-definition'
import { createDrizzlePostgresTestDatabase } from '../packages/drizzle-storage/tests/testDatabase'

// Since we use dynamic imports vite(st) won't recognize that these files
// need to be transpiled and result in errors. We import them manually here
import '@credo-ts/drizzle-storage/didcomm'
import '@credo-ts/drizzle-storage/anoncreds'
import '@credo-ts/drizzle-storage/action-menu'
import '@credo-ts/drizzle-storage/drpc'
import '@credo-ts/drizzle-storage/openid4vc'
import '@credo-ts/drizzle-storage/tenants'
import '@credo-ts/drizzle-storage/question-answer'

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
