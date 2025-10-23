import 'reflect-metadata'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { DidCommConnectionRecord } from '@credo-ts/didcomm'

// NOTE: import from '@credo-ts/core' in setup makes tests fail
import { LogLevel } from '../packages/core/src/logger/Logger'
import testLogger from '../packages/core/tests/logger'

// Get test file path at module load
const testPath = expect.getState().testPath
const relativeTestPath = testPath ? path.relative(process.cwd(), testPath) : undefined

// Create a log file name based on test file
const logFileName = relativeTestPath?.replace(/[/\\]/g, '_').replace(/\.[^.]+$/, '.log')
const logDir = path.join(process.cwd(), 'testlogs')
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
    writeFileSync(logPath, JSON.stringify([{ testPath: relativeTestPath, source: 'after-all' }, ...logEntries]))
  })
}

process.on('unhandledRejection', (reason) => {
  // biome-ignore lint/suspicious/noConsole: no explanation
  console.error('Unhandled rejection in test', {
    reason,
    relativeTestPath,
  })
  testLogger.error('Unhandled rejection in test', {
    reason,
    relativeTestPath,
  })

  if (logPath && process.env.COLLECT_FAILED_TEST_LOGS === 'true') {
    mkdirSync(logDir, { recursive: true })
    writeFileSync(
      logPath,
      JSON.stringify([{ testPath: relativeTestPath, source: 'unhandled-rejection' }, ...logEntries])
    )
    // Also create specific unhandled-rejection.log
    writeFileSync(
      path.join(logDir, 'unhandled-rejection.log'),
      JSON.stringify([{ testPath: relativeTestPath, source: 'unhandled-rejection' }, ...logEntries])
    )
  }
  process.exit(1)
})

process.on('uncaughtException', (reason) => {
  // biome-ignore lint/suspicious/noConsole: no explanation
  console.error('Uncaught exception in test', {
    reason,
    relativeTestPath,
  })
  testLogger.error('Uncaught exception in test', {
    reason,
    relativeTestPath,
  })

  if (logPath && process.env.COLLECT_FAILED_TEST_LOGS === 'true') {
    mkdirSync(logDir, { recursive: true })
    writeFileSync(
      logPath,
      JSON.stringify([{ testPath: relativeTestPath, source: 'uncaught-exception' }, ...logEntries])
    )

    // Also create specific uncaught-exception.log
    writeFileSync(
      path.join(logDir, 'uncaught-exception.log'),
      JSON.stringify([{ testPath: relativeTestPath, source: 'uncaught-exception' }, ...logEntries])
    )
  }
})

process.on('SIGTERM', () => {
  testLogger.warn('[SIGTERM] Process received SIGTERM')
})

process.on('SIGINT', () => {
  testLogger.warn('[SIGINT] Process received SIGINT')
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
  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  interface Matchers<T = any> extends CustomMatchers<T> {}
}
