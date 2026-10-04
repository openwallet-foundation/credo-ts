import { describe, expect, it } from 'vitest'
import { RequestBodyTooLargeError, readRequestBody } from '../body'
import type { HttpRequest } from '../HttpTypes'

function request(body: Uint8Array[], headers = new Headers()): HttpRequest {
  let bodyUsed = false
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of body) controller.enqueue(chunk)
      controller.close()
    },
  })

  return {
    method: 'POST',
    url: 'https://example.test/',
    headers,
    signal: {
      aborted: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    },
    body: stream,
    get bodyUsed() {
      return bodyUsed
    },
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob([]),
    formData: async () => new FormData(),
    json: async () => undefined,
    text: async () => '',
    clone() {
      bodyUsed = true
      return this
    },
  }
}

describe('readRequestBody', () => {
  it('reads a body within the configured limit', async () => {
    const body = new TextEncoder().encode('hello')

    await expect(readRequestBody(request([body]), { maxBytes: 5 })).resolves.toEqual(body)
  })

  it('rejects a body over the configured limit from its Content-Length', async () => {
    const headers = new Headers({ 'content-length': '6' })

    await expect(readRequestBody(request([new Uint8Array(5)], headers), { maxBytes: 5 })).rejects.toBeInstanceOf(
      RequestBodyTooLargeError
    )
  })

  it('rejects a streamed body over the configured limit without Content-Length', async () => {
    await expect(
      readRequestBody(request([new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])]), { maxBytes: 5 })
    ).rejects.toBeInstanceOf(RequestBodyTooLargeError)
  })

  it('rejects invalid limits and content lengths', async () => {
    const invalidLength = request([new TextEncoder().encode('hello')], new Headers({ 'content-length': 'invalid' }))

    await expect(readRequestBody(invalidLength, { maxBytes: -1 })).rejects.toThrow(RangeError)
    await expect(readRequestBody(invalidLength, { maxBytes: 5 })).rejects.toThrow(TypeError)
  })
})
