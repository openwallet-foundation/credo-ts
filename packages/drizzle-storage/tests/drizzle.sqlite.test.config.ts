import { defineConfig } from 'drizzle-kit'

const didcommSqliteShema = require.resolve('@credo-ts/drizzle-storage/didcomm/sqlite')
const coreSqliteShema = require.resolve('@credo-ts/drizzle-storage/core/sqlite')

export default defineConfig({
  dialect: 'sqlite',
  schema: [coreSqliteShema, didcommSqliteShema],
  out: './tests/drizzle-sqlite',
  dbCredentials: {
    url: ':memory:',
  },
})
