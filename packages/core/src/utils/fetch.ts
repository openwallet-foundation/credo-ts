import type { AgentDependencies } from '../agent/AgentDependencies'

export interface FetchLimits {
  /**
   * Maximum response size in bytes. If exceeded, the download is aborted.
   */
  maxResponseBytes?: number

  /**
   * Timeout in milliseconds for the request, including reading a response that has a size limit.
   */
  timeoutMs?: number
}

export async function fetchWithTimeout(
  fetch: AgentDependencies['fetch'],
  url: string | URL | Request,
  init?: RequestInit & FetchLimits
): Promise<Response> {
  const abortController = new AbortController()
  const { timeoutMs = 5000, maxResponseBytes, signal, ...requestInit } = init ?? {}

  const timeout = setTimeout(() => abortController.abort(), timeoutMs)
  const abortFromSignal = () => abortController.abort()
  if (signal?.aborted) abortController.abort()
  signal?.addEventListener('abort', abortFromSignal)

  try {
    const response = await fetch(url, {
      ...requestInit,
      signal: abortController.signal as NonNullable<RequestInit['signal']>,
    })

    if (maxResponseBytes === undefined) {
      return response
    }

    // Check Content-Length header first (if available)
    const contentLength = response.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > maxResponseBytes) {
      abortController.abort()
      throw new Error(`Response too large: ${contentLength} bytes exceeds limit of ${maxResponseBytes}`)
    }

    // Stream the body and abort if it exceeds the limit
    const reader = response.body?.getReader()
    if (!reader) {
      return response
    }

    let receivedBytes = 0
    const chunks: Uint8Array[] = []

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      receivedBytes += value.length

      if (receivedBytes > maxResponseBytes) {
        await reader.cancel()
        throw new Error(`Response exceeded limit of ${maxResponseBytes} bytes`)
      }

      chunks.push(value)
    }

    // Reconstruct the response with the buffered body
    const body = new Blob(chunks)
    const bufferedResponse = new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    })
    // The Response constructor can't set these, and callers read them to follow redirects
    Object.defineProperties(bufferedResponse, {
      url: { value: response.url },
      redirected: { value: response.redirected },
    })
    return bufferedResponse
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abortFromSignal)
  }
}
