import { AgentConfig, type AgentContext, type AgentDependencies, JsonEncoder, type Logger } from '@credo-ts/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DidCommModuleConfig } from '../../DidCommModuleConfig'
import { type DidCommEncryptedMessage, DidCommMimeType, type DidCommOutboundPackage } from '../../types'
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

describe('DidCommHttpOutboundTransport', () => {
  const logger = { debug: vi.fn(), error: vi.fn() }
  const outboundPackage = (responseRequested: boolean): DidCommOutboundPackage => ({
    payload: { protected: '', iv: '', ciphertext: '', tag: '' },
    endpoint: 'https://example.com',
    responseRequested,
  })

  let fetch: ReturnType<typeof vi.fn>
  let transport: DidCommHttpOutboundTransport

  beforeEach(async () => {
    vi.useFakeTimers()
    fetch = vi.fn()
    const agentContext = {
      config: new AgentConfig({ logger: logger as unknown as Logger }, { fetch } as unknown as AgentDependencies),
      dependencyManager: { resolve: () => new DidCommModuleConfig() },
    } as unknown as AgentContext
    transport = new DidCommHttpOutboundTransport()
    await transport.start(agentContext)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('sets a request timeout and clears it when the request fails', async () => {
    let rejectFetch: (error: Error) => void = () => {}
    fetch.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectFetch = reject
      })
    )

    const sending = transport.sendMessage(outboundPackage(false))
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(vi.getTimerCount()).toBe(1)

    rejectFetch(new Error('connection refused'))
    await expect(sending).rejects.toThrow()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears the request timeout when the request succeeds', async () => {
    fetch.mockResolvedValue(new Response('', { status: 200 }))

    await expect(transport.sendMessage(outboundPackage(false))).resolves.toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('still aborts a request that gets no response within the timeout', async () => {
    fetch.mockImplementation(
      (_endpoint: string, { signal }: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
        })
    )

    const sending = transport.sendMessage(outboundPackage(true))
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled())
    await vi.advanceTimersByTimeAsync(15000)

    await expect(sending).resolves.toBeUndefined()
    expect(logger.debug).toHaveBeenCalledWith(
      'Request was aborted due to timeout. Not throwing error due to return routing on sent message'
    )
    expect(vi.getTimerCount()).toBe(0)
  })

  describe('content type', () => {
    async function sentContentType(payload: DidCommEncryptedMessage): Promise<string> {
      fetch.mockResolvedValue(new Response('', { status: 202 }))
      await transport.sendMessage({ payload, endpoint: 'https://example.com' })

      const [, init] = fetch.mock.calls[0] as unknown as [string, { headers: Record<string, string> }]
      return init.headers['Content-Type']
    }

    it('sends a v2 envelope with the v2 encrypted media type', async () => {
      expect(await sentContentType(v2Envelope)).toBe(DIDCOMM_V2_ENCRYPTED_MIME_TYPE)
    })

    it('sends a v1 envelope with the configured v1 media type', async () => {
      expect(await sentContentType(v1Envelope)).toBe(DidCommMimeType.V1)
    })
  })
})
