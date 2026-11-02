import { describe, expect, it } from 'vitest'
import { readBodyText } from '../body'

// The global Request type is React Native's in this monorepo, the constructor is undici's
const request = (body: string | ReadableStream<Uint8Array>, headers: Record<string, string> = {}) =>
  new Request('http://localhost', { method: 'POST', body, headers, duplex: 'half' }) as Request

describe('readBodyText', () => {
  it('reads a body within the limit', async () => {
    expect(await readBodyText(request('héllo'), 6)).toBe('héllo')
  })

  it('rejects a body whose content-length exceeds the limit, without reading it', async () => {
    const req = request('hello', { 'content-length': '5' })
    expect(await readBodyText(req, 4)).toBeUndefined()
    expect(req.bodyUsed).toBe(false)
  })

  it('stops reading a streamed body once it exceeds the limit', async () => {
    let pulled = 0
    const endless = new ReadableStream<Uint8Array>({
      pull: (controller) => {
        pulled++
        controller.enqueue(new Uint8Array(1024))
      },
    })

    expect(await readBodyText(request(endless), 4096)).toBeUndefined()
    expect(pulled).toBeLessThan(10)
  })
})
