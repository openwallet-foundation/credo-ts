import type { AgentDependencies } from '../agent/AgentDependencies'

export async function fetchWithTimeout(
  fetch: AgentDependencies['fetch'],
  url: string,
  init?: Omit<RequestInit, 'signal'> & {
    /**
     * @default 5000
     */
    timeoutMs?: number
    /**
     * Maximum response size in bytes. If exceeded, the download is aborted.
     */
    maxResponseBytes?: number
  }
): Promise<Response> {
  const abortController = new AbortController()
  const timeoutMs = init?.timeoutMs ?? 5000
  const maxResponseBytes = init?.maxResponseBytes

  const timeout = setTimeout(() => abortController.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...init,
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
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    })
  } finally {
    clearTimeout(timeout)
  }
}
