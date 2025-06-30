import { spawn } from 'child_process'
import path from 'path'
import { Dialect } from './generate-migrations'
import { errorLog, log } from './utils'

interface RunStudioOptions {
  database: {
    dialect: Dialect
    url: string
  }
}

export async function runStudio({ database }: RunStudioOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const configPath = path.join(__dirname, 'drizzle.config.ts')

    const studioResult = spawn('npx', ['drizzle-kit', 'studio', '--config', configPath], {
      env: {
        ...process.env,
        DRIZZLE_DATABASE_URL: database.url,
        DRIZZLE_DIALECT: database.dialect,
      },
    })

    studioResult.stdout.setEncoding('utf-8')
    studioResult.stdout.on('data', (data) => log(data))
    studioResult.stderr.setEncoding('utf-8').on('data', (data) => errorLog(data))
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
