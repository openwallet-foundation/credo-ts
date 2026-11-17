import type { AgentContext } from '../../../../../agent'
import { UniversalDidResolver } from '../UniversalDidResolver'

const did = 'did:ethr:0xb9c5714089478a327f09197987f16f9e5d936e8a'
const document = {
  '@context': ['https://www.w3.org/ns/did/v1'],
  id: did,
  verificationMethod: [
    {
      id: `${did}#controller`,
      type: 'EcdsaSecp256k1RecoveryMethod2020',
      controller: did,
      blockchainAccountId: `eip155:1:0xb9c5714089478a327f09197987f16f9e5d936e8a`,
    },
  ],
  authentication: [`${did}#controller`],
}

const respond = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => {
    if (body === undefined) throw new Error('not json')
    return body
  },
})

function setup(
  response: ReturnType<typeof respond> | Error,
  options: ConstructorParameters<typeof UniversalDidResolver>[0]
) {
  const fetch = vi.fn(async () => {
    if (response instanceof Error) throw response
    return response
  })
  const agentContext = { config: { fetch } } as unknown as AgentContext
  const resolver = new UniversalDidResolver(options)
  return {
    fetch,
    resolve: () => resolver.resolve(agentContext, did, { did, method: 'ethr', id: did.split(':')[2] } as never, {}),
    resolver,
  }
}

describe('UniversalDidResolver', () => {
  it('supports the methods it is given, and no others', () => {
    expect(setup(respond(200, document), { methods: ['ethr', 'ion'] }).resolver.supportedMethods).toEqual([
      'ethr',
      'ion',
    ])
  })

  it('asks the endpoint for the DID and reads a resolution result', async () => {
    const { resolve, fetch } = setup(
      respond(200, {
        didDocument: document,
        didDocumentMetadata: { updated: '2026-01-01' },
        didResolutionMetadata: { contentType: 'application/did+ld+json' },
      }),
      { methods: ['ethr'], url: 'https://resolver.example.com/1.0/identifiers' }
    )
    const result = await resolve()

    expect(fetch).toHaveBeenCalledWith(
      `https://resolver.example.com/1.0/identifiers/${did}`,
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: expect.stringContaining('application/did+ld+json') }),
      })
    )
    expect(result.didDocument?.id).toBe(did)
    expect(result.didDocumentMetadata).toEqual({ updated: '2026-01-01' })
    expect(result.didResolutionMetadata.error).toBeUndefined()
  })

  it('reads a response that is the document itself', async () => {
    const result = await setup(respond(200, document), { methods: ['ethr'] }).resolve()
    expect(result.didDocument?.id).toBe(did)
  })

  it('uses the development instance by default', async () => {
    const { resolve, fetch } = setup(respond(200, document), { methods: ['ethr'] })
    await resolve()
    expect(fetch).toHaveBeenCalledWith(`https://dev.uniresolver.io/1.0/identifiers/${did}`, expect.anything())
  })

  it('does not accept a document for another DID', async () => {
    const result = await setup(respond(200, { didDocument: { ...document, id: 'did:ethr:0x1234' } }), {
      methods: ['ethr'],
    }).resolve()
    expect(result.didDocument).toBeNull()
    expect(result.didResolutionMetadata.error).toBe('invalidDidDocument')
  })

  it('reports a DID that is not found', async () => {
    const notFound = await setup(respond(404, { didResolutionMetadata: { error: 'notFound' } }), {
      methods: ['ethr'],
    }).resolve()
    expect(notFound.didDocument).toBeNull()
    expect(notFound.didResolutionMetadata.error).toBe('notFound')

    const noDocument = await setup(respond(200, { didResolutionMetadata: {}, didDocument: null }), {
      methods: ['ethr'],
    }).resolve()
    expect(noDocument.didResolutionMetadata.error).toBe('notFound')
  })

  it('reports a failing service, a response that is not JSON, and a network error', async () => {
    expect((await setup(respond(500, undefined), { methods: ['ethr'] }).resolve()).didResolutionMetadata.error).toBe(
      'internalError'
    )
    expect((await setup(respond(200, undefined), { methods: ['ethr'] }).resolve()).didResolutionMetadata.error).toBe(
      'invalidDidDocument'
    )
    const network = await setup(new Error('connect ECONNREFUSED'), { methods: ['ethr'] }).resolve()
    expect(network.didDocument).toBeNull()
    expect(network.didResolutionMetadata.error).toBe('internalError')
  })
})
