import fetch, { BodyInit } from 'node-fetch'
import testLogger from '../src/__tests__/logger'

export async function get(url: string) {
  testLogger.debug(`HTTP GET request: '${url}'`)
  const response = await fetch(url)
  testLogger.debug(`HTTP GET response status: ${response.status} - ${response.statusText}`)
  return response.text()
}

export async function post(url: string, body: BodyInit) {
  testLogger.debug(`HTTP POST request: '${url}'`)
  const response = await fetch(url, { method: 'POST', body })
  testLogger.debug(`HTTP POST response status: ${response.status} - ${response.statusText}`)
  return response.text()
}
