import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchWithTimeout } from '../fetch'

const limits = { maxResponseBytes: 100, timeoutMs: 5000 }

function bytesResponse(byteLength: number, withContentLength = true): Response {
  return new Response(new Uint8Array(byteLength), {
    headers: withContentLength ? { 'content-length': String(byteLength) } : {},
  })
}

// Like React Native's built-in fetch, which doesn't expose the response body as a stream
function nonStreamingResponse(byteLength: number): Response {
  return {
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    url: 'https://example.com',
    redirected: false,
    body: undefined,
    arrayBuffer: async () => new Uint8Array(byteLength).buffer,
  } as unknown as Response
}

function asFetch(fetch: unknown) {
  return fetch as typeof globalThis.fetch
}

describe('fetchWithTimeout', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects when the Content-Length exceeds maxResponseBytes', async () => {
    const fetch = vi.fn(async () => bytesResponse(1000))

    await expect(fetchWithTimeout(asFetch(fetch), 'https://example.com', limits)).rejects.toThrow(/too large/)
  })

  it('rejects when the streamed body exceeds maxResponseBytes', async () => {
    // No content-length header, so the size is only known while streaming.
    const fetch = vi.fn(async () => bytesResponse(1000, false))

    await expect(fetchWithTimeout(asFetch(fetch), 'https://example.com', limits)).rejects.toThrow(/exceeded limit/)
  })

  it('rejects a response that is not streamed when it exceeds maxResponseBytes', async () => {
    const fetch = vi.fn(async () => nonStreamingResponse(1000))

    await expect(fetchWithTimeout(asFetch(fetch), 'https://example.com', limits)).rejects.toThrow(/exceeded limit/)
  })

  it('returns a response that is not streamed when under the limit', async () => {
    const fetch = vi.fn(async () => nonStreamingResponse(5))

    const result = await fetchWithTimeout(asFetch(fetch), 'https://example.com', limits)

    expect((await result.arrayBuffer()).byteLength).toBe(5)
  })

  it('returns the buffered response when under the limit, preserving status', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5])
    const fetch = vi.fn(
      async () =>
        new Response(bytes, {
          status: 201,
          headers: { 'content-length': String(bytes.length) },
        })
    )

    const result = await fetchWithTimeout(asFetch(fetch), 'https://example.com', limits)

    expect(result.status).toBe(201)
    expect(result.ok).toBe(true)
    expect(Array.from(new Uint8Array(await result.arrayBuffer()))).toEqual(Array.from(bytes))
  })

  it('does not use Blob, which React Native does not support for byte arrays', async () => {
    const fetch = vi.fn(async () => bytesResponse(5, false))
    vi.stubGlobal(
      'Blob',
      class {
        public constructor() {
          throw new Error('Blob is not supported')
        }
      }
    )

    const result = await fetchWithTimeout(asFetch(fetch), 'https://example.com', limits)

    expect((await result.arrayBuffer()).byteLength).toBe(5)
  })

  it('returns a response without a body for a 204 status', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }))

    const result = await fetchWithTimeout(asFetch(fetch), 'https://example.com', limits)

    expect(result.status).toBe(204)
    expect(result.body).toBeNull()
  })

  it('drops the content-encoding and content-length headers of the decoded body', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(new Uint8Array(5), {
          headers: { 'content-encoding': 'gzip', 'content-length': '3', 'content-type': 'application/json' },
        })
    )

    const result = await fetchWithTimeout(asFetch(fetch), 'https://example.com', limits)

    expect(result.headers.get('content-encoding')).toBeNull()
    expect(result.headers.get('content-length')).toBeNull()
    expect(result.headers.get('content-type')).toBe('application/json')
  })

  it('keeps the url and redirected flag of the original response', async () => {
    const response = bytesResponse(5)
    Object.defineProperties(response, {
      url: { value: 'https://example.com/redirected' },
      redirected: { value: true },
    })
    const fetch = vi.fn(async () => response)

    const result = await fetchWithTimeout(asFetch(fetch), 'https://example.com', limits)

    expect(result).not.toBe(response)
    expect(result.url).toBe('https://example.com/redirected')
    expect(result.redirected).toBe(true)
  })

  it('aborts the request when it exceeds the timeout', async () => {
    const fetch = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
        })
    )

    await expect(
      fetchWithTimeout(asFetch(fetch), 'https://example.com', { ...limits, timeoutMs: 10 })
    ).rejects.toThrow()
  })

  it('aborts the request with the reason of the caller when its signal aborts', async () => {
    const fetch = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
        })
    )
    const abortController = new AbortController()
    const reason = new Error('cancelled by the caller')

    const result = fetchWithTimeout(asFetch(fetch), 'https://example.com', {
      ...limits,
      signal: abortController.signal as NonNullable<RequestInit['signal']>,
    })
    abortController.abort(reason)

    await expect(result).rejects.toBe(reason)
  })
})
