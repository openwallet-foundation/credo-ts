import { shell } from 'shell'
import { Dialect, generateMigrations } from './generate-migrations'
import { runMigrations } from './run-migrations'
import { runStudio } from './run-studio'
import { errorLog, log } from './utils'

// Configure the CLI app using Shell.js configuration object
export const cli = shell({
  name: '@credo-ts/drizzle-storage',
  description: 'Database migration and studio tool for Credo TS Drizzle Storage',
  options: {
    bundle: {
      shortcut: 'b',
      type: 'array',
      required: true,
      description: 'The drizzle record bundle to apply migrations for',
    },
    silent: {
      shortcut: 's',
      type: 'boolean',
      required: false,
      description: 'Do not print output to console',
    },
  },
  commands: {
    generate: {
      description: 'Generate database migrations for specified dialects and schemas',
      options: {
        name: {
          shortcut: 'n',
          description: 'Name for the migration',
        },
        dialect: {
          shortcut: 'd',
          type: 'array',
          enum: ['postgres', 'sqlite'],
          default: ['postgres', 'sqlite'],
          description: 'Database dialect to generate migrations for',
        },
      },
      handler: async ({
        params,
      }: {
        params: {
          silent?: boolean
          bundle: string[]
          dialect: Dialect[]
          name?: string
        }
      }) => {
        try {
          await generateMigrations({
            dialects: params.dialect,
            bundles: params.bundle,
            name: params.name,
            silent: params.silent,
          })
          if (!params.silent) log('Migration generation completed successfully!')
        } catch (error) {
          if (!params.silent) errorLog('Error generating migrations:', error instanceof Error ? error.message : error)
          process.exit(1)
        }
      },
    },
    migrate: {
      description: 'Apply database migrations for specified database and schemas',
      options: {
        dialect: {
          shortcut: 'd',
          required: true,
          enum: ['postgres', 'sqlite'],
          description: 'Database dialect to apply migrations for',
        },
        'database-url': {
          shortcut: 'u',
          description:
            "Database URL to push migrations to. You can also provide the database url using the 'DRIZZLE_DATABASE_URL' environment variable.",
          required: () => process.env.DRIZZLE_DATABASE_URL === undefined,
        },
      },
      handler: async ({
        params,
      }: {
        params: {
          silent?: boolean
          bundle: string[]
          dialect: Dialect
          'database-url'?: string
        }
      }) => {
        try {
          const databaseUrl = params['database-url'] ?? process.env.DRIZZLE_DATABASE_URL
          if (!databaseUrl) {
            throw new Error('Missing required database url')
          }
          await runMigrations({
            database: {
              dialect: params.dialect,
              url: databaseUrl,
            },
            bundles: params.bundle,
            silent: params.silent,
          })
          if (!params.silent) log('Applying migrations completed successfully!')
        } catch (error) {
          if (!params.silent) errorLog('Error applying migrations:', error instanceof Error ? error.message : error)
          process.exit(1)
        }
      },
    },
    studio: {
      description: 'Run Drizzle Studio for specified database',
      options: {
        dialect: {
          shortcut: 'd',
          required: true,
          enum: ['postgres', 'sqlite'],
          description: 'Database dialect to run Drizzle Studio with',
        },
        'database-url': {
          shortcut: 'u',
          description:
            "Database URL to run Drizzle Studio with. You can also provide the database url using the 'DRIZZLE_DATABASE_URL' environment variable.",
          required: () => process.env.DRIZZLE_DATABASE_URL === undefined,
        },
      },
      handler: async ({
        params,
      }: {
        params: {
          silent?: boolean
          dialect: Dialect
          'database-url'?: string
        }
      }) => {
        try {
          const databaseUrl = params['database-url'] ?? process.env.DRIZZLE_DATABASE_URL
          if (!databaseUrl) {
            throw new Error('Missing required database url')
          }

          await runStudio({
            database: {
              dialect: params.dialect,
              url: databaseUrl,
            },
            silent: params.silent,
          })
          if (!params.silent) log('Drizzle Studio completed successfully!')
        } catch (error) {
          if (!params.silent) errorLog('Error running Drizzle Studio:', error instanceof Error ? error.message : error)
          process.exit(1)
        }
      },
    },
  },
})
