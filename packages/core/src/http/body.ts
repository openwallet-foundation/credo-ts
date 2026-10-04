import type { HttpRequest } from './HttpTypes'

export class RequestBodyTooLargeError extends Error {
  public readonly status = 413

  public constructor(maxBytes: number) {
    super(`Request body exceeds the configured limit of ${maxBytes} bytes`)
    this.name = 'RequestBodyTooLargeError'
  }
}

export async function readRequestBody(request: HttpRequest, { maxBytes }: { maxBytes: number }): Promise<Uint8Array> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new RangeError(`maxBytes must be a non-negative safe integer, received ${maxBytes}`)
  }

  const contentLength = request.headers.get('content-length')
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) throw new TypeError('Invalid Content-Length header')
    const parsedLength = Number(contentLength)
    if (!Number.isSafeInteger(parsedLength)) throw new TypeError('Invalid Content-Length header')
    if (parsedLength > maxBytes) throw new RequestBodyTooLargeError(maxBytes)
  }

  const body = request.body
  if (!body) return new Uint8Array()

  if (typeof body.getReader !== 'function') {
    const bytes = new Uint8Array(await request.arrayBuffer())
    if (bytes.byteLength > maxBytes) throw new RequestBodyTooLargeError(maxBytes)
    return bytes
  }

  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      totalBytes += value.byteLength
      if (totalBytes > maxBytes) {
        const error = new RequestBodyTooLargeError(maxBytes)
        try {
          await reader.cancel(error)
        } catch {
          throw new RequestBodyTooLargeError(maxBytes)
        }
        throw error
      }

      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const result = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }

  return result
}
