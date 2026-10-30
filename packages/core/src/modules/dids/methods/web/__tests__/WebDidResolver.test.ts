import { agentDependencies, getAgentContext } from '../../../../../../tests/helpers'
import type { AgentContext } from '../../../../../agent'
import { AgentConfig } from '../../../../../agent/AgentConfig'
import type { AgentDependencies } from '../../../../../agent/AgentDependencies'
import { parseDid } from '../../../domain/parse'
import { WebDidResolver } from '../WebDidResolver'

describe('WebDidResolver', () => {
  let resolver: WebDidResolver

  beforeEach(() => {
    resolver = new WebDidResolver()
  })

  function createAgentContext(fetch: AgentDependencies['fetch']): AgentContext {
    return getAgentContext({
      agentConfig: new AgentConfig({}, { ...agentDependencies, fetch }),
    })
  }

  function createFetch(response: Response) {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const fetch: AgentDependencies['fetch'] = async (input, init) => {
      calls.push({ url: String(input), init })
      return response
    }
    return { fetch, calls }
  }

  async function resolve(context: AgentContext, did: string) {
    return resolver.resolve(context, did, parseDid(did), {})
  }

  it('uses the agent fetch with a timeout signal and the resolver request options', async () => {
    const did = 'did:web:example.com'
    const { fetch, calls } = createFetch(
      new Response(JSON.stringify({ id: did }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    const result = await resolve(createAgentContext(fetch), did)

    expect(result.didDocument?.id).toBe(did)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://example.com/.well-known/did.json')
    expect(calls[0].init?.mode).toBe('cors')
    expect(calls[0].init?.signal).toBeInstanceOf(AbortSignal)
  })

  it('aborts the agent fetch after the default timeout', async () => {
    vi.useFakeTimers()

    try {
      const did = 'did:web:example.com'
      let receivedSignal = false
      let signalAborted = false
      let markFetchStarted: () => void = () => {
        throw new Error('Fetch was not called')
      }
      const fetchStarted = new Promise<void>((resolveFetchStarted) => {
        markFetchStarted = resolveFetchStarted
      })
      const fetch: AgentDependencies['fetch'] = async (_input, init) => {
        const signal = init?.signal
        if (!signal) throw new Error('Timeout signal was not passed to agent fetch')

        receivedSignal = true
        markFetchStarted()

        return new Promise<Response>((_resolve, reject) => {
          signal.addEventListener(
            'abort',
            () => {
              signalAborted = signal.aborted
              reject(new Error('Agent fetch aborted'))
            },
            { once: true }
          )
        })
      }
      const agentContext = createAgentContext(fetch)
      const pendingResolution = resolve(agentContext, did)

      await fetchStarted
      expect(receivedSignal).toBe(true)
      await vi.advanceTimersByTimeAsync(agentContext.config.fetchLimits.timeoutMs - 1)
      expect(signalAborted).toBe(false)
      await vi.advanceTimersByTimeAsync(1)

      const result = await pendingResolution
      expect(signalAborted).toBe(true)
      expect(result.didResolutionMetadata.error).toBe('resolutionError')
    } finally {
      vi.useRealTimers()
    }
  })

  it('returns notFound and no document when the document id does not match', async () => {
    const did = 'did:web:example.com'
    const { fetch } = createFetch(
      new Response(JSON.stringify({ id: 'did:web:other.example' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )

    const result = await resolve(createAgentContext(fetch), did)

    expect(result.didDocument).toBeNull()
    expect(result.didResolutionMetadata.error).toBe('notFound')
  })

  it.each([
    [500, 'resolutionError'],
    [404, 'notFound'],
  ] as const)('maps HTTP %i to %s', async (status, expectedError) => {
    const did = 'did:web:example.com'
    const { fetch } = createFetch(new Response('', { status }))

    const result = await resolve(createAgentContext(fetch), did)

    expect(result.didDocument).toBeNull()
    expect(result.didResolutionMetadata.error).toBe(expectedError)
  })

  it('rejects invalid hosts without making a fetch request', async () => {
    const did = 'did:web:exa%20mple.com'
    const { fetch, calls } = createFetch(new Response(''))

    const result = await resolve(createAgentContext(fetch), did)

    expect(result.didDocument).toBeNull()
    expect(result.didResolutionMetadata.error).toBe('invalidDid')
    expect(calls).toHaveLength(0)
  })
})
