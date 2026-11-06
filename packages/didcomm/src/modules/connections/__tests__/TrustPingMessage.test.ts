import {
  DidCommTrustPingMessage,
  DidCommTrustPingResponseMessage,
  DidCommTrustPingResponseV2Message,
  DidCommTrustPingV2Message,
} from '../messages'

describe('Trust ping messages', () => {
  it.each([
    ['https://didcomm.org/trust_ping/1.0/ping', 'v1', new DidCommTrustPingMessage({})],
    [
      'https://didcomm.org/trust_ping/1.0/ping_response',
      'v1',
      new DidCommTrustPingResponseMessage({ threadId: 'ping-id' }),
    ],
    ['https://didcomm.org/trust-ping/2.0/ping', 'v2', new DidCommTrustPingV2Message({})],
    [
      'https://didcomm.org/trust-ping/2.0/ping-response',
      'v2',
      new DidCommTrustPingResponseV2Message({ threadId: 'ping-id' }),
    ],
  ])('%s only supports DIDComm %s', (type, didcommVersion, message) => {
    expect(message.type).toBe(type)
    expect(message.supportedDidCommVersions).toEqual([didcommVersion])
  })
})
