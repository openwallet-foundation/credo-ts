import type { AgentDependencies } from '../agent/AgentDependencies'

export interface FetchLimits {
  /**
   * Maximum response size in bytes. If exceeded, the download is aborted.
   */
  maxResponseBytes?: number

  /**
   * Timeout in milliseconds for the request, including reading the response.
   */
  timeoutMs?: number
}

/**
 * Fetches and buffers the response, failing when it takes longer than `timeoutMs` or is larger than `maxResponseBytes`.
 *
 * The download stops at the limit when the fetch exposes the response body as a stream. With a fetch that doesn't,
 * such as React Native's built-in fetch, the whole response is downloaded and the limit is checked afterwards.
 */
export async function fetchWithTimeout(
  fetch: AgentDependencies['fetch'],
  url: string | URL | Request,
  init: RequestInit & Required<FetchLimits>
): Promise<Response> {
  const abortController = new AbortController()
  const { timeoutMs, maxResponseBytes, signal, ...requestInit } = init

  const timeout = setTimeout(() => abortController.abort(), timeoutMs)
  const abortFromSignal = () => abortController.abort(signal?.reason)
  if (signal?.aborted) abortFromSignal()
  signal?.addEventListener('abort', abortFromSignal)

  try {
    const response = await fetch(url, {
      ...requestInit,
      signal: abortController.signal as NonNullable<RequestInit['signal']>,
    })

    // Check Content-Length header first (if available)
    const contentLength = response.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > maxResponseBytes) {
      abortController.abort()
      throw new Error(`Response too large: ${contentLength} bytes exceeds limit of ${maxResponseBytes}`)
    }

    // A response without a body, such as a 204
    if (response.body === null) {
      return createBufferedResponse(response, new Uint8Array())
    }

    // React Native's built-in fetch has no `body` stream, so `reader` is undefined. It downloads the whole body
    // before fetch resolves, so the size limit can only be checked afterwards
    const reader = response.body?.getReader()
    if (!reader) {
      const body = new Uint8Array(await response.arrayBuffer())
      if (body.length > maxResponseBytes) {
        throw new Error(`Response exceeded limit of ${maxResponseBytes} bytes`)
      }

      return createBufferedResponse(response, body)
    }

    // Stream the body and abort if it exceeds the limit
    let receivedBytes = 0
    const chunks: Uint8Array[] = []

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      receivedBytes += value.length

      if (receivedBytes > maxResponseBytes) {
        abortController.abort()
        await reader.cancel().catch(() => {})
        throw new Error(`Response exceeded limit of ${maxResponseBytes} bytes`)
      }

      chunks.push(value)
    }

    // React Native's Blob doesn't accept byte arrays, so the chunks are joined into one Uint8Array
    const body = new Uint8Array(receivedBytes)
    let offset = 0
    for (const chunk of chunks) {
      body.set(chunk, offset)
      offset += chunk.length
    }

    return createBufferedResponse(response, body)
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abortFromSignal)
  }
}

function createBufferedResponse(response: Response, body: Uint8Array) {
  // The body is already decoded, so these headers no longer describe it
  const headers = new Headers(response.headers)
  headers.delete('content-encoding')
  headers.delete('content-length')

  // Statuses such as 204 can't have a body, not even an empty one
  const bufferedResponse = new Response(body.length > 0 ? body : null, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })

  // The Response constructor can't set these, and callers read them to follow redirects
  Object.defineProperties(bufferedResponse, {
    url: { value: response.url },
    redirected: { value: response.redirected },
  })

  return bufferedResponse
}
