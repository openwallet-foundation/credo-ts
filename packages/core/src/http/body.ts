/**
 * Reads the request body as text, or returns `undefined` once it exceeds `maxBytes`. Stops reading at the limit, so a
 * large or endless body is never buffered.
 */
export async function readBodyText(request: Request, maxBytes: number): Promise<string | undefined> {
  if (Number(request.headers.get('content-length')) > maxBytes) return undefined
  if (!request.body) return ''

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0

  for (let result = await reader.read(); !result.done; result = await reader.read()) {
    size += result.value.byteLength
    if (size > maxBytes) {
      await reader.cancel()
      return undefined
    }
    chunks.push(result.value)
  }

  const body = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(body)
}
