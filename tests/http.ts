import type { BodyInit } from 'node-fetch'

import testLogger from '../packages/core/tests/logger'

import { agentDependencies } from '@aries-framework/node'

export async function get(url: string) {
  testLogger.debug(`HTTP GET request: '${url}'`)
  const response = await agentDependencies.fetch(url)
  testLogger.debug(`HTTP GET response status: ${response.status} - ${response.statusText}`)
  return response.text()
}

export async function post(url: string, body: BodyInit) {
  testLogger.debug(`HTTP POST request: '${url}'`)
  const response = await agentDependencies.fetch(url, { method: 'POST', body })
  testLogger.debug(`HTTP POST response status: ${response.status} - ${response.statusText}`)
  return response.text()
}
