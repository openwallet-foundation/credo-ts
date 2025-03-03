import type { Express } from 'express'
import type { Body, ReplyFnContext } from 'nock'

import { Buffer } from '@credo-ts/core'
import nock, { cleanAll } from 'nock'
import request from 'supertest'

// Helper function to forward requests from nock to express
export function setupNockToExpress(baseUrl: string, app: Express) {
  async function reply(this: ReplyFnContext, _uri: string, body: Body) {
    // Get the original request details
    const { method, path, headers } = this.req

    // Forward the request to our Express app using supertest
    const supertestInstance = request(app)

    let testRequest = supertestInstance[method.toLowerCase() as 'post'](path)

    // Add original headers (excluding some that might interfere)
    for (const [key, value] of Object.entries(headers)) {
      if (!['host', 'content-length'].includes(key.toLowerCase())) {
        testRequest = testRequest.set(key, value)
      }
    }

    // Add marker header to prevent infinite loops
    testRequest = testRequest.set('x-forwarded-from-nock', 'true')

    // Add body for POST/PUT/PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(method) && body) {
      testRequest = testRequest.send(body)
    }

    // Disable automatic JSON parsing, there's something weird if a string is returned
    testRequest = testRequest.buffer(true).parse((res, cb) => {
      let data = Buffer.from('')
      res.on('data', (chunk) => {
        data = Buffer.concat([data, chunk])
      })
      res.on('end', () => {
        cb(null, data.toString())
      })
    })

    try {
      const response = await testRequest
      return [response.status, response.body, response.headers]
    } catch (_error) {
      return [500, { error: 'Internal Server Error' }]
    }
  }

  // Intercept all HTTP methods
  nock(baseUrl)
    .persist()
    .post(() => true)
    .reply(reply)
    .get(() => true)
    .reply(reply)
    .put(() => true)
    .reply(reply)
    .delete(() => true)
    .reply(reply)
    .options(() => true)
    .reply(reply)
    .patch(() => true)
    .reply(reply)

  jest.mock('cross-fetch', () => ({
    fetch,
  }))

  return () => {
    cleanAll()
    jest.clearAllMocks()
  }
}
