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

  it('maps lang to ~l10n', () => {
    const v2: DidCommV2PlaintextMessage = {
      id: 'msg-1',
      type: 'https://didcomm.org/trust-ping/1.0/ping',
      lang: 'en',
    }
    const v1 = normalizeV2PlaintextToV1(v2)
    expect(v1['~l10n']).toEqual({ locale: 'en' })
  })

  it('maps attachments to ~attach with id and media_type', () => {
    const v2: DidCommV2PlaintextMessage = {
      id: 'msg-1',
      type: 'https://didcomm.org/trust-ping/1.0/ping',
      attachments: [
        {
          id: 'att-1',
          description: 'Example attachment',
          media_type: 'application/json',
          data: { base64: 'e30=' },
        },
      ],
    }
    const v1 = normalizeV2PlaintextToV1(v2)
    const attach = v1['~attach'] as Array<Record<string, unknown>>
    expect(attach).toHaveLength(1)
    expect(attach[0]).toMatchObject({
      '@id': 'att-1',
      description: 'Example attachment',
      'mime-type': 'application/json',
      data: { base64: 'e30=' },
    })
  })

  it('passes through created_time and expires_time', () => {
    const v2: DidCommV2PlaintextMessage = {
      id: 'msg-1',
      type: 'https://didcomm.org/trust-ping/1.0/ping',
      created_time: 1547577721,
      expires_time: 1547581321,
    }
    const v1 = normalizeV2PlaintextToV1(v2)
    expect(v1.created_time).toBe(1547577721)
    expect(v1.expires_time).toBe(1547581321)
  })

  it('round-trip: v2 with lang, attachments, thread, and body normalizes to v1', () => {
    const v2: DidCommV2PlaintextMessage = {
      id: 'msg-round',
      type: 'https://didcomm.org/trust-ping/1.0/ping',
      from: 'did:example:alice',
      to: ['did:example:bob'],
      thid: 'thread-1',
      pthid: 'pthread-1',
      lang: 'fr',
      created_time: 1547577721,
      attachments: [
        {
          id: 'att-1',
          data: { json: { foo: 'bar' } },
        },
      ],
      body: { comment: 'hello' },
    }
    const v1 = normalizeV2PlaintextToV1(v2)

    expect(v1['@type']).toBe(v2.type)
    expect(v1['@id']).toBe(v2.id)
    expect(v1.from).toBe(v2.from)
    expect(v1.to).toEqual(v2.to)
    expect(v1['~thread']).toEqual({ thid: 'thread-1', pthid: 'pthread-1' })
    expect(v1['~l10n']).toEqual({ locale: 'fr' })
    expect(v1.created_time).toBe(1547577721)
    const attach = v1['~attach'] as Array<Record<string, unknown>>
    expect(attach).toHaveLength(1)
    expect(attach[0]).toMatchObject({ '@id': 'att-1', data: { json: { foo: 'bar' } } })
    expect(v1.comment).toBe('hello')
  })
})
