import { defineConfig } from 'drizzle-kit'

const didcommPostgresShema = require.resolve('@credo-ts/drizzle-storage/didcomm/postgres')
const corePostgresShema = require.resolve('@credo-ts/drizzle-storage/core/postgres')

export default defineConfig({
  dialect: 'postgresql',
  schema: [corePostgresShema, didcommPostgresShema],
  out: './tests/drizzle-postgres',
  dbCredentials: {
    url: 'memory://',
  },
})
