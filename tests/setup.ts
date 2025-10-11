import 'reflect-metadata'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { LogLevel } from '@credo-ts/core'
import type { DidCommConnectionRecord } from '@credo-ts/didcomm'
import { testLogger } from '../packages/core/tests'

// Get test file path at module load
const testPath = expect.getState().testPath
const relativeTestPath = testPath ? path.relative(process.cwd(), testPath) : undefined

// Create a log file name based on test file
const logFileName = relativeTestPath?.replace(/[\/\\]/g, '_').replace(/\.[^.]+$/, '.log')
const logDir = path.join(process.cwd(), 'test-logs')
const logPath = logFileName ? path.join(logDir, logFileName) : undefined

const logEntries: Array<object> = []
if (logPath && process.env.COLLECT_FAILED_TEST_LOGS === 'true') {
  testLogger.logLevel = LogLevel.trace
  testLogger.logger.attachTransport((logEntry) => logEntries.push(logEntry))
  testLogger.logger.settings.minLevel = 0
  testLogger.logger.settings.type = 'hidden'
  let testFailed = false

  afterEach((context) => {
    if (context.task.result?.state === 'fail') {
      testFailed = true
    }
  })

  // Track if any test failed
  afterAll(() => {
    if (!testFailed) return

    mkdirSync(logDir, { recursive: true })
    writeFileSync(logPath, JSON.stringify(logEntries))
  })
}

process.on('unhandledRejection', (reason) => {
  // biome-ignore lint/suspicious/noConsole: <explanation>
  console.error('Unhandled rejection in test', {
    reason,
    relativeTestPath,
  })

  if (logPath && process.env.COLLECT_FAILED_TEST_LOGS === 'true') {
    mkdirSync(logDir, { recursive: true })
    writeFileSync(logPath, JSON.stringify(logEntries))
  }
  process.exit(1)
})

process.on('uncaughtException', (reason) => {
  // biome-ignore lint/suspicious/noConsole: <explanation>
  console.error('Uncaught exception in test', {
    reason,
    relativeTestPath,
  })

  if (logPath && process.env.COLLECT_FAILED_TEST_LOGS === 'true') {
    mkdirSync(logDir, { recursive: true })
    writeFileSync(logPath, JSON.stringify(logEntries))
  }
})

process.on('SIGTERM', () => {
  testLogger.warn('[SIGTERM] Process received SIGTERM')

  if (logPath && process.env.COLLECT_FAILED_TEST_LOGS === 'true') {
    mkdirSync(logDir, { recursive: true })
    writeFileSync(logPath, JSON.stringify(logEntries))
  }
})

process.on('SIGINT', () => {
  testLogger.warn('[SIGINT] Process received SIGINT')

  if (logPath && process.env.COLLECT_FAILED_TEST_LOGS === 'true') {
    mkdirSync(logDir, { recursive: true })
    writeFileSync(logPath, JSON.stringify(logEntries))
  }
})

expect.extend({
  toBeConnectedWith,
})

// Custom matchers which can be used to extend Vitest matchers via extend, e. g. `expect.extend({ toBeConnectedWith })`.
function toBeConnectedWith(actual: DidCommConnectionRecord, expected: DidCommConnectionRecord) {
  actual.assertReady()
  expected.assertReady()

  const pass = actual.theirDid === expected.did
  if (pass) {
    return {
      message: () => `expected connection ${actual.theirDid} not to be connected to with ${expected.did}`,
      pass: true,
    }
  }
  return {
    message: () => `expected connection ${actual.theirDid} to be connected to with ${expected.did}`,
    pass: false,
  }
}

interface CustomMatchers<R = unknown> {
  toBeConnectedWith(connection: DidCommConnectionRecord): R
}

declare module 'vitest' {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  interface Matchers<T = any> extends CustomMatchers<T> {}
}
