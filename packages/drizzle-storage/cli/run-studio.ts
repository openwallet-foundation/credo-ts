import { spawn } from 'child_process'
import { Dialect } from './generate-migrations'
import { errorLog, getDrizzleConfigPath, getDrizzleKitCliPath, log } from './utils'

interface RunStudioOptions {
  database: {
    dialect: Dialect
    url: string
  }
  silent?: boolean
}

export async function runStudio({ database, silent }: RunStudioOptions): Promise<void> {
  const drizzleConfigPath = getDrizzleConfigPath()
  const drizzleKitCliPath = getDrizzleKitCliPath()

  return new Promise((resolve, reject) => {
    const studioResult = spawn(drizzleKitCliPath, ['studio', '--config', drizzleConfigPath], {
      env: {
        ...process.env,
        DRIZZLE_DATABASE_URL: database.url,
        DRIZZLE_DIALECT: database.dialect,
      },
    })

    studioResult.stdout.setEncoding('utf-8')
    studioResult.stdout.on('data', (data) => {
      if (!silent) log(data)
    })
    studioResult.stderr.setEncoding('utf-8').on('data', (data) => {
      if (!silent) errorLog(data)
    })
    studioResult.stderr.on('data', (data) => log(data))

    studioResult.on('close', (code) => {
      if (code === 0) return resolve()

      return reject(
        new Error(
          `Error running drizzle studio with dialect ${database.dialect}. Error: ${studioResult.stderr || studioResult.stdout}`
        )
      )
    })
  })
}
