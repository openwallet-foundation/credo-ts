import type { AgentContext } from '@credo-ts/core'
import { JsonEncoder } from '@credo-ts/core'

import { type DidCommEncryptedMessage, DidCommMimeType } from '../../types'
import { DIDCOMM_V2_ENCRYPTED_MIME_TYPE } from '../../v2/types'
import { DidCommHttpOutboundTransport } from '../DidCommHttpOutboundTransport'

const jwe = { iv: 'iv', ciphertext: 'ciphertext', tag: 'tag' }
const v1Envelope = {
  ...jwe,
  protected: JsonEncoder.toBase64Url({
    enc: 'xchacha20poly1305_ietf',
    typ: 'JWM/1.0',
    alg: 'Authcrypt',
    recipients: [],
  }),
}
const v2Envelope = {
  ...jwe,
  protected: JsonEncoder.toBase64Url({ alg: 'ECDH-ES+A256KW', enc: 'A256CBC-HS512' }),
  recipients: [{ header: { kid: 'did:example:bob#key-1' }, encrypted_key: 'key' }],
}

async function sentContentType(payload: DidCommEncryptedMessage): Promise<string> {
  const fetch = vi.fn(async () => ({ status: 202, text: async () => '' }))
  const agentContext = {
    config: {
      logger: { debug: vi.fn(), error: vi.fn() },
      agentDependencies: { fetch },
    },
    dependencyManager: { resolve: () => ({ didCommMimeType: DidCommMimeType.V1 }) },
  } as unknown as AgentContext

  const transport = new DidCommHttpOutboundTransport()
  await transport.start(agentContext)
  await transport.sendMessage({ payload, endpoint: 'http://localhost/didcomm' })

  const [, init] = fetch.mock.calls[0] as unknown as [string, { headers: Record<string, string> }]
  return init.headers['Content-Type']
}

describe('DidCommHttpOutboundTransport', () => {
  it('sends a v2 envelope with the v2 encrypted media type', async () => {
    expect(await sentContentType(v2Envelope)).toBe(DIDCOMM_V2_ENCRYPTED_MIME_TYPE)
  })

  it('sends a v1 envelope with the configured v1 media type', async () => {
    expect(await sentContentType(v1Envelope)).toBe(DidCommMimeType.V1)
  })
})
