import { describe, expect, it, vi } from 'vitest'

import { fetchWithTimeout } from '../fetch'

function bytesResponse(byteLength: number, withContentLength = true): Response {
  const bytes = new Uint8Array(byteLength)
  return new Response(new Blob([bytes]), {
    headers: withContentLength ? { 'content-length': String(byteLength) } : {},
  })
}

describe('fetchWithTimeout', () => {
  it('returns the original response untouched when maxResponseBytes is undefined', async () => {
    const response = bytesResponse(1000)
    const fetch = vi.fn(async () => response)

    const result = await fetchWithTimeout(fetch as unknown as typeof globalThis.fetch, 'https://example.com')
    expect(result).toBe(response)
  })

  it('rejects when the Content-Length exceeds maxResponseBytes', async () => {
    const fetch = vi.fn(async () => bytesResponse(1000))

    await expect(
      fetchWithTimeout(fetch as unknown as typeof globalThis.fetch, 'https://example.com', { maxResponseBytes: 100 })
    ).rejects.toThrow(/too large/)
  })

  it('rejects when the streamed body exceeds maxResponseBytes', async () => {
    // No content-length header, so the size is only known while streaming.
    const fetch = vi.fn(async () => bytesResponse(1000, false))

    await expect(
      fetchWithTimeout(fetch as unknown as typeof globalThis.fetch, 'https://example.com', { maxResponseBytes: 100 })
    ).rejects.toThrow(/exceeded limit/)
  })

  it('returns the buffered response when under the limit, preserving status', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5])
    const fetch = vi.fn(
      async () =>
        new Response(new Blob([bytes]), {
          status: 201,
          headers: { 'content-length': String(bytes.length) },
        })
    )

    const result = await fetchWithTimeout(fetch as unknown as typeof globalThis.fetch, 'https://example.com', {
      maxResponseBytes: 100,
    })

    expect(result.status).toBe(201)
    expect(result.ok).toBe(true)
    expect(Array.from(new Uint8Array(await result.arrayBuffer()))).toEqual(Array.from(bytes))
  })

  it('aborts the request when it exceeds the timeout', async () => {
    const fetch = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
        })
    )

    await expect(
      fetchWithTimeout(fetch as unknown as typeof globalThis.fetch, 'https://example.com', { timeoutMs: 10 })
    ).rejects.toThrow()
  })
})
