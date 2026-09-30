import { JsonTransformer } from '@credo-ts/core'

import { DidCommTrustPingMessage } from '../../modules/connections/messages/DidCommTrustPingMessage'
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

  it('maps a top-level return_route header to the ~transport decorator', () => {
    const v2: DidCommV2PlaintextMessage = {
      id: 'msg-rr',
      type: 'https://didcomm.org/message-pickup/4.0/status-request',
      body: {},
      return_route: 'all',
    }
    const v1 = normalizeV2PlaintextToV1(v2)
    expect(v1['~transport']).toEqual({ return_route: 'all' })
    expect(v1).not.toHaveProperty('return_route')
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

  it('does not let body fields override header-derived values', () => {
    const v2: DidCommV2PlaintextMessage = {
      id: 'msg-1',
      type: 'https://didcomm.org/trust-ping/2.0/ping',
      from: 'did:example:alice',
      thid: 'thread-1',
      body: {
        '@type': 'https://didcomm.org/other/1.0/message',
        '@id': 'body-id',
        from: 'did:example:mallory',
        to: ['did:example:mallory'],
        '~thread': { thid: 'body-thread' },
        '~please_ack': { on: ['RECEIPT'] },
        comment: 'hello',
      },
    }
    const v1 = normalizeV2PlaintextToV1(v2)
    expect(v1['@type']).toBe('https://didcomm.org/trust-ping/2.0/ping')
    expect(v1['@id']).toBe('msg-1')
    expect(v1.from).toBe('did:example:alice')
    expect(v1).not.toHaveProperty('to')
    expect(v1['~thread']).toEqual({ thid: 'thread-1' })
    expect(v1).not.toHaveProperty('~please_ack')
    expect(v1.comment).toBe('hello')
  })

  it('drops body from and ~thread when there is no matching header', () => {
    const v2: DidCommV2PlaintextMessage = {
      id: 'msg-1',
      type: 'https://didcomm.org/trust-ping/2.0/ping',
      body: { from: 'did:example:mallory', '~thread': { thid: 'body-thread' } },
    }
    const v1 = normalizeV2PlaintextToV1(v2)
    expect(v1).not.toHaveProperty('from')
    expect(v1).not.toHaveProperty('~thread')
  })

  it('drops a body lang when there is no lang header', () => {
    const v2: DidCommV2PlaintextMessage = {
      id: 'msg-1',
      type: 'https://didcomm.org/trust-ping/2.0/ping',
      body: { comment: 'hi', lang: 'xx' },
    }
    const v1 = normalizeV2PlaintextToV1(v2)
    expect(v1).not.toHaveProperty('lang')
    expect(v1).not.toHaveProperty('~l10n')
  })

  it('keeps the from_prior header and drops a body from_prior', () => {
    const fromHeader = normalizeV2PlaintextToV1({
      id: 'msg-1',
      type: 'https://didcomm.org/empty/1.0/empty',
      from_prior: 'header.jwt.value',
      body: { from_prior: 'body.jwt.value' },
    })
    expect(fromHeader.from_prior).toBe('header.jwt.value')

    const fromBodyOnly = normalizeV2PlaintextToV1({
      id: 'msg-2',
      type: 'https://didcomm.org/empty/1.0/empty',
      body: { from_prior: 'body.jwt.value' },
    })
    expect(fromBodyOnly).not.toHaveProperty('from_prior')
  })

  it('ignores unknown headers', () => {
    const v2: DidCommV2PlaintextMessage = {
      id: 'msg-1',
      type: 'https://didcomm.org/basicmessage/2.0/message',
      content: { ext: true },
      custom_header: 'ignored',
      body: { content: 'hi' },
    }
    const v1 = normalizeV2PlaintextToV1(v2)
    expect(v1.content).toBe('hi')
    expect(v1).not.toHaveProperty('custom_header')
  })

  it('drops ~service and ~timing from headers and body', () => {
    const service = { recipientKeys: ['key'], serviceEndpoint: 'https://example.com' }
    const v1 = normalizeV2PlaintextToV1({
      id: 'msg-1',
      type: 'https://didcomm.org/trust_ping/1.0/ping',
      '~service': service,
      body: { comment: 'hi', '~service': service, '~timing': { out_time: '2020-01-01T00:00:00.000Z' } },
    })
    expect(v1).not.toHaveProperty('~service')
    expect(v1).not.toHaveProperty('~timing')
    expect(v1.comment).toBe('hi')
  })

  it('does not let body keys named after decorator properties set the decorators', () => {
    const v1 = normalizeV2PlaintextToV1({
      id: 'ping-msg-1',
      type: 'https://didcomm.org/trust_ping/1.0/ping',
      body: {
        comment: 'hi',
        service: {
          recipientKeys: ['8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'],
          serviceEndpoint: 'https://evil.example',
        },
        timing: { out_time: '2020-01-01T00:00:00.000Z' },
        thread: { thid: 'body-thread' },
        transport: { return_route: 'all' },
        pleaseAck: { on: ['RECEIPT'] },
        l10n: { locale: 'xx' },
        appendedAttachments: [{ '@id': 'att-1', data: { base64: 'YQ==' } }],
      },
    })
    const message = JsonTransformer.fromJSON(v1, DidCommTrustPingMessage)
    expect(message.comment).toBe('hi')
    expect(message.service).toBeUndefined()
    expect(message.timing).toBeUndefined()
    expect(message.thread).toBeUndefined()
    expect(message.transport).toBeUndefined()
    expect(message.pleaseAck).toBeUndefined()
    expect(message.l10n).toBeUndefined()
    expect(message.appendedAttachments).toBeUndefined()
  })

  it('maps please_ack for the current message to ~please_ack', () => {
    const v2: DidCommV2PlaintextMessage = {
      id: 'msg-1',
      type: 'https://didcomm.org/trust-ping/2.0/ping',
      please_ack: [''],
    }
    const v1 = normalizeV2PlaintextToV1(v2)
    expect(v1['~please_ack']).toEqual({ on: ['RECEIPT'] })
    expect(v1).not.toHaveProperty('please_ack')
  })

  it('maps please_ack listing the current message id to ~please_ack', () => {
    const v2: DidCommV2PlaintextMessage = {
      id: 'msg-1',
      type: 'https://didcomm.org/trust-ping/2.0/ping',
      please_ack: ['msg-1'],
    }
    const v1 = normalizeV2PlaintextToV1(v2)
    expect(v1['~please_ack']).toEqual({ on: ['RECEIPT'] })
  })

  it('does not request an ack of the current message when please_ack only lists other ids', () => {
    const v2: DidCommV2PlaintextMessage = {
      id: 'msg-1',
      type: 'https://didcomm.org/trust-ping/2.0/ping',
      please_ack: ['abc'],
    }
    const v1 = normalizeV2PlaintextToV1(v2)
    expect(v1).not.toHaveProperty('~please_ack')
    expect(v1).not.toHaveProperty('please_ack')
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
