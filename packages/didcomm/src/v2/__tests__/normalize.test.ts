import { normalizeV2PlaintextToV1 } from '../normalize'
import type { DidCommV2PlaintextMessage } from '../types'

describe('normalizeV2PlaintextToV1', () => {
  it('maps type to @type and id to @id', () => {
    const v2: DidCommV2PlaintextMessage = {
      id: 'msg-123',
      type: 'https://didcomm.org/trust-ping/1.0/ping',
    }
    const v1 = normalizeV2PlaintextToV1(v2)
    expect(v1['@type']).toBe('https://didcomm.org/trust-ping/1.0/ping')
    expect(v1['@id']).toBe('msg-123')
  })

  it('spreads body into top level', () => {
    const v2: DidCommV2PlaintextMessage = {
      id: 'msg-1',
      type: 'https://didcomm.org/trust-ping/1.0/ping',
      body: { response_requested: true, comment: 'hello' },
    }
    const v1 = normalizeV2PlaintextToV1(v2)
    expect(v1.response_requested).toBe(true)
    expect(v1.comment).toBe('hello')
  })

  it('maps thid and pthid to ~thread', () => {
    const v2: DidCommV2PlaintextMessage = {
      id: 'msg-1',
      type: 'https://didcomm.org/trust-ping/1.0/ping',
      thid: 'parent-thread',
      pthid: 'grandparent-thread',
    }
    const v1 = normalizeV2PlaintextToV1(v2)
    expect(v1['~thread']).toEqual({ thid: 'parent-thread', pthid: 'grandparent-thread' })
  })

  it('preserves from and to', () => {
    const v2: DidCommV2PlaintextMessage = {
      id: 'msg-1',
      type: 'https://didcomm.org/trust-ping/1.0/ping',
      from: 'did:example:alice',
      to: ['did:example:bob'],
    }
    const v1 = normalizeV2PlaintextToV1(v2)
    expect(v1.from).toBe('did:example:alice')
    expect(v1.to).toEqual(['did:example:bob'])
  })
})
