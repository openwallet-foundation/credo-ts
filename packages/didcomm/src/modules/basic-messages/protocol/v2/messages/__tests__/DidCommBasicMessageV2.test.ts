import { DidCommBasicMessageV2 } from '../DidCommBasicMessageV2'

describe('DidCommBasicMessageV2', () => {
  it('creates message with required content and generated id/createdTime', () => {
    const msg = new DidCommBasicMessageV2({ content: 'Hello' })
    expect(msg.content).toBe('Hello')
    expect(msg.id).toBeDefined()
    expect(msg.createdTime).toBeGreaterThan(0)
    expect(msg.type).toBe('https://didcomm.org/basicmessage/2.0/message')
  })

  it('accepts optional lang and parentThreadId', () => {
    const msg = new DidCommBasicMessageV2({
      content: 'Hello',
      lang: 'en',
      parentThreadId: 'parent-123',
    })
    expect(msg.lang).toBe('en')
    expect(msg.thread?.parentThreadId).toBe('parent-123')
  })

  it('accepts custom id and createdTime', () => {
    const msg = new DidCommBasicMessageV2({
      content: 'Hello',
      id: 'custom-id',
      createdTime: 1700000000,
    })
    expect(msg.id).toBe('custom-id')
    expect(msg.createdTime).toBe(1700000000)
  })

  describe('toV2Plaintext', () => {
    it('returns v2 plaintext format with id, type, created_time, body.content', () => {
      const msg = new DidCommBasicMessageV2({
        content: 'Hello',
        id: 'msg-123',
        createdTime: 1700000000,
      })
      const v2 = msg.toV2Plaintext()
      expect(v2.id).toBe('msg-123')
      expect(v2.type).toBe('https://didcomm.org/basicmessage/2.0/message')
      expect(v2.created_time).toBe(1700000000)
      expect(v2.body).toEqual({ content: 'Hello' })
    })

    it('includes lang when set', () => {
      const msg = new DidCommBasicMessageV2({
        content: 'Hello',
        lang: 'en',
      })
      const v2 = msg.toV2Plaintext()
      expect(v2.lang).toBe('en')
    })

    it('includes thid and pthid when thread is set', () => {
      const msg = new DidCommBasicMessageV2({
        content: 'Reply',
        parentThreadId: 'parent-123',
      })
      msg.setThread({ threadId: 'thread-456', parentThreadId: 'parent-123' })
      const v2 = msg.toV2Plaintext()
      expect(v2.thid).toBe('thread-456')
      expect(v2.pthid).toBe('parent-123')
    })
  })
})
