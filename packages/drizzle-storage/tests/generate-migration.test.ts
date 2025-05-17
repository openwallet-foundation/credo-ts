import { spawnSync } from 'child_process'

describe.each(['postgres', 'sqlite'] as const)('Generate drizzle migration for %s', (databaseType) => {
  test('successfully generated migration file', () => {
    const result = spawnSync(
      'pnpm drizzle-kit',
      ['generate', '--config', `tests/drizzle.${databaseType}.test.config.ts`],
      {
        shell: true,
        cwd: __dirname,
        encoding: 'utf-8',
      }
    )

    expect(result.status).toEqual(0)
  })
})
