import { JsonTransformer } from '@credo-ts/core'

import { DidCommAttachment, DidCommAttachmentData } from '../../decorators/attachment/DidCommAttachment'
import { ReturnRouteTypes } from '../../decorators/transport/TransportDecorator'
import { DidCommTrustPingMessage } from '../../modules/connections/messages/DidCommTrustPingMessage'
import { normalizeV2PlaintextToV1 } from '../normalize'
import { buildV2PlaintextFromMessage } from '../plaintextBuilder'

describe('buildV2PlaintextFromMessage', () => {
  it('maps @type to type and @id to id', () => {
    const message = new DidCommTrustPingMessage({ comment: 'hi', responseRequested: false })
    const v2 = buildV2PlaintextFromMessage(message)
    expect(v2.type).toMatch(/https:\/\/didcomm\.org\/trust_ping\/1\.0\/ping/)
    expect(v2.id).toBeDefined()
    expect(v2.body).toMatchObject({ comment: 'hi', response_requested: false })
  })

  it('maps ~thread to thid and pthid', () => {
    const message = new DidCommTrustPingMessage({ comment: 'hi' })
    message.setThread({ threadId: 'thread-1', parentThreadId: 'pthread-1' })
    const v2 = buildV2PlaintextFromMessage(message)
    expect(v2.thid).toBe('thread-1')
    expect(v2.pthid).toBe('pthread-1')
  })

  it('maps ~l10n to lang', () => {
    const message = new DidCommTrustPingMessage({ comment: 'hi' })
    message.addLocale('fr')
    const v2 = buildV2PlaintextFromMessage(message)
    expect(v2.lang).toBe('fr')
  })

  it('maps ~attach to attachments', () => {
    const message = new DidCommTrustPingMessage({ comment: 'hi' })
    const attachment = new DidCommAttachment({
      id: 'att-1',
      data: new DidCommAttachmentData({ json: { foo: 'bar' } }),
      mimeType: 'application/json',
    })
    message.addAppendedAttachment(attachment)

    const v2 = buildV2PlaintextFromMessage(message)
    expect(v2.attachments).toHaveLength(1)
    expect(v2.attachments?.[0]).toMatchObject({
      id: 'att-1',
      media_type: 'application/json',
      data: { json: { foo: 'bar' } },
    })
  })

  it('lifts ~transport return_route to a top-level v2 return_route header', () => {
    const message = new DidCommTrustPingMessage({ comment: 'hi' })
    message.setReturnRouting(ReturnRouteTypes.all)
    const v2 = buildV2PlaintextFromMessage(message)
    expect(v2.return_route).toBe('all')
    expect(v2.body).not.toHaveProperty('~transport')
  })

  it('maps ~please_ack to a please_ack header for the current message', () => {
    const message = new DidCommTrustPingMessage({ comment: 'hi' })
    message.setPleaseAck()
    const v2 = buildV2PlaintextFromMessage(message)
    expect(v2.please_ack).toEqual([''])
    expect(v2.body).not.toHaveProperty('~please_ack')
  })

  it('maps ~timing to created_time and expires_time and keeps decorators out of the body', () => {
    const message = new DidCommTrustPingMessage({ comment: 'hi' })
    message.setTiming({
      outTime: new Date('2020-01-01T00:00:00.500Z'),
      expiresTime: new Date('2020-01-01T01:00:00.000Z'),
      delayMilli: 10,
    })
    message.setService({ recipientKeys: ['key'], serviceEndpoint: 'https://example.com' })

    const v2 = buildV2PlaintextFromMessage(message)
    expect(v2.created_time).toBe(1577836800)
    expect(v2.expires_time).toBe(1577840400)
    expect(v2.body).toEqual({ comment: 'hi', response_requested: true })
  })

  it('keeps created_time and expires_time already on the message over ~timing', () => {
    const received = normalizeV2PlaintextToV1({
      id: 'received-msg-1',
      type: 'https://didcomm.org/trust_ping/1.0/ping',
      created_time: 100,
      expires_time: 200,
      body: { comment: 'hi' },
    })
    const message = JsonTransformer.fromJSON(received, DidCommTrustPingMessage)
    message.setTiming({
      outTime: new Date('2020-01-01T00:00:00.000Z'),
      expiresTime: new Date('2020-01-01T01:00:00.000Z'),
    })

    const v2 = buildV2PlaintextFromMessage(message)
    expect(v2.created_time).toBe(100)
    expect(v2.expires_time).toBe(200)
  })

  it('keeps lang and please_ack as headers when a received v2 message is sent again', () => {
    const received = normalizeV2PlaintextToV1({
      id: 'received-msg-1',
      type: 'https://didcomm.org/trust_ping/1.0/ping',
      lang: 'fr',
      please_ack: [''],
      body: { comment: 'hi' },
    })
    const message = JsonTransformer.fromJSON(received, DidCommTrustPingMessage)

    const v2 = buildV2PlaintextFromMessage(message)
    expect(v2.lang).toBe('fr')
    expect(v2.please_ack).toEqual([''])
    expect(v2.body).toEqual({ comment: 'hi', response_requested: true })
  })

  it('round-trip: message with thread, locale, and attachment produces v2 with all fields', () => {
    const message = new DidCommTrustPingMessage({ comment: 'hello' })
    message.setThread({ threadId: 't1', parentThreadId: 'pt1' })
    message.addLocale('en')
    const attachment = new DidCommAttachment({
      id: 'att-round',
      data: new DidCommAttachmentData({ base64: 'e30=' }),
    })
    message.addAppendedAttachment(attachment)

    const v2 = buildV2PlaintextFromMessage(message)

    expect(v2.type).toMatch(/trust_ping/)
    expect(v2.body).toMatchObject({ comment: 'hello' })
    expect(v2.thid).toBe('t1')
    expect(v2.pthid).toBe('pt1')
    expect(v2.lang).toBe('en')
    expect(v2.attachments).toHaveLength(1)
    expect(v2.attachments?.[0].id).toBe('att-round')
    expect(v2.attachments?.[0].data).toEqual({ base64: 'e30=' })
  })
})
