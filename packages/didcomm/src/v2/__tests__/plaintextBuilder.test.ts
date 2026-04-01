import { DidCommAttachment, DidCommAttachmentData } from '../../decorators/attachment/DidCommAttachment'
import { DidCommTrustPingMessage } from '../../modules/connections/messages/DidCommTrustPingMessage'
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
    expect(v2.attachments![0]).toMatchObject({
      id: 'att-1',
      media_type: 'application/json',
      data: { json: { foo: 'bar' } },
    })
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
    expect(v2.attachments![0].id).toBe('att-round')
    expect(v2.attachments![0].data).toEqual({ base64: 'e30=' })
  })
})
