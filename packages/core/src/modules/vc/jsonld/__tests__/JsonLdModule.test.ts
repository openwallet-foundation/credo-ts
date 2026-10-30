import { getAgentConfig, getAgentContext } from '../../../../../tests/helpers'
import { DependencyManager } from '../../../../plugins/DependencyManager'
import { DidResolverService } from '../../../dids'
import { SECURITY_ED25519_2018_CONTEXT_URL, SECURITY_ED25519_2020_CONTEXT_URL } from '../../constants'
import { W3cV2DataIntegrityContextValidator } from '../../data-integrity'
import { W3cCredentialsModule } from '../../W3cCredentialsModule'
import { W3cCredentialsModuleConfig } from '../../W3cCredentialsModuleConfig'
import { W3cV2CredentialsModule } from '../../W3cV2CredentialsModule'
import { DEFAULT_CONTEXTS } from '../contexts'
import { defaultDocumentLoader } from '../documentLoader'
import { JsonLdModule } from '../JsonLdModule'
import { JsonLdModuleConfig } from '../JsonLdModuleConfig'

describe('JsonLdModule', () => {
  test('registers shared JSON-LD configuration', () => {
    const dependencyManager = new DependencyManager()
    const module = new JsonLdModule()

    module.register(dependencyManager)

    expect(dependencyManager.resolve(JsonLdModuleConfig)).toBe(module.config)
  })

  test('registers a custom document loader', () => {
    const documentLoader = vi.fn()
    const module = new JsonLdModule({ documentLoader })

    expect(module.config.documentLoader).toBe(documentLoader)
  })

  test('registering W3cV2CredentialsModule alongside a standalone JsonLdModule shares one configuration instance', () => {
    const dependencyManager = new DependencyManager()
    const documentLoader = vi.fn()

    dependencyManager.registerModules({
      jsonLd: new JsonLdModule({ documentLoader }),
      w3cV2Credentials: new W3cV2CredentialsModule(),
    })

    expect(dependencyManager.resolve(JsonLdModuleConfig).documentLoader).toBe(documentLoader)
  })

  test('does not mutate the supplied options', () => {
    const documentLoader = vi.fn()
    const options = { documentLoader }

    new JsonLdModule(options)

    expect(options).toEqual({ documentLoader })
  })

  test('uses one shared configuration instance for VC and JSON-LD tokens', () => {
    const dependencyManager = new DependencyManager()
    const module = new W3cCredentialsModule()

    module.register(dependencyManager)

    expect(dependencyManager.resolve(JsonLdModuleConfig)).toBe(dependencyManager.resolve(W3cCredentialsModuleConfig))
  })

  test('registering W3cV2CredentialsModule alongside W3cCredentialsModule shares one JsonLdModuleConfig instance', () => {
    const dependencyManager = new DependencyManager()

    dependencyManager.registerModules({
      w3cCredentials: new W3cCredentialsModule(),
      w3cV2Credentials: new W3cV2CredentialsModule(),
    })

    const config = dependencyManager.resolve(JsonLdModuleConfig)
    const validator = dependencyManager.resolve(W3cV2DataIntegrityContextValidator)

    // The validator must have been constructed with the same JsonLdModuleConfig instance
    // that W3cCredentialsModule registered, not a second, independently-created one.
    expect((validator as unknown as { jsonLdModuleConfig: JsonLdModuleConfig }).jsonLdModuleConfig).toBe(config)
  })

  test('W3cV2CredentialsModule registers its own JsonLdModuleConfig when registered standalone', () => {
    const dependencyManager = new DependencyManager()

    new W3cV2CredentialsModule().register(dependencyManager)

    expect(dependencyManager.isRegistered(JsonLdModuleConfig)).toBe(true)
    expect(() => dependencyManager.resolve(W3cV2DataIntegrityContextValidator)).not.toThrow()
  })

  test('defaultDocumentLoader resolves Ed25519 suite contexts from DEFAULT_CONTEXTS', async () => {
    const agentContext = getAgentContext({
      agentConfig: getAgentConfig('JsonLdModuleTest'),
      registerInstances: [[DidResolverService, {}]],
    })
    const documentLoader = defaultDocumentLoader(agentContext)

    await expect(documentLoader(SECURITY_ED25519_2018_CONTEXT_URL)).resolves.toEqual({
      contextUrl: null,
      documentUrl: SECURITY_ED25519_2018_CONTEXT_URL,
      document: DEFAULT_CONTEXTS[SECURITY_ED25519_2018_CONTEXT_URL],
    })
    await expect(documentLoader(SECURITY_ED25519_2020_CONTEXT_URL)).resolves.toEqual({
      contextUrl: null,
      documentUrl: SECURITY_ED25519_2020_CONTEXT_URL,
      document: DEFAULT_CONTEXTS[SECURITY_ED25519_2020_CONTEXT_URL],
    })
  })

  test('defaultDocumentLoader resolves bundled context URLs with fragments', async () => {
    const agentContext = getAgentContext({
      agentConfig: getAgentConfig('JsonLdModuleTest'),
      registerInstances: [[DidResolverService, {}]],
    })
    const documentLoader = defaultDocumentLoader(agentContext)
    const contextUrlWithFragment = `${SECURITY_ED25519_2018_CONTEXT_URL}#foo`

    await expect(documentLoader(contextUrlWithFragment)).resolves.toEqual({
      contextUrl: null,
      documentUrl: contextUrlWithFragment,
      document: DEFAULT_CONTEXTS[SECURITY_ED25519_2018_CONTEXT_URL],
    })
  })

  describe('defaultDocumentLoader remote documents', () => {
    const remoteContext = { '@context': { name: 'https://schema.org/name' } }

    const setup = (jsonLdModuleConfig = new JsonLdModuleConfig()) => {
      const agentContext = getAgentContext({
        agentConfig: getAgentConfig('JsonLdModuleTest'),
        registerInstances: [
          [DidResolverService, {}],
          [JsonLdModuleConfig, jsonLdModuleConfig],
        ],
      })
      const fetchSpy = vi.spyOn(agentContext.config, 'fetch')
      return { agentContext, fetchSpy, documentLoader: defaultDocumentLoader(agentContext) }
    }

    const jsonResponse = (body: unknown, { url, headers }: { url?: string; headers?: Record<string, string> } = {}) => {
      const response = new Response(JSON.stringify(body), { headers })
      if (url) Object.defineProperty(response, 'url', { value: url })
      return response
    }

    test('fetches with the agent fetch and the configured size limit', async () => {
      const { documentLoader, fetchSpy } = setup(new JsonLdModuleConfig({ maxDocumentBytes: 1000 }))
      fetchSpy.mockResolvedValue(jsonResponse(remoteContext))

      await expect(documentLoader('https://example.com/context')).resolves.toEqual({
        contextUrl: null,
        documentUrl: 'https://example.com/context',
        document: remoteContext,
      })
      expect(fetchSpy).toHaveBeenCalledWith('https://example.com/context', {
        headers: { Accept: 'application/ld+json, application/json' },
        maxResponseBytes: 1000,
      })
    })

    test('rejects http urls unless insecure http urls are allowed', async () => {
      const { documentLoader, fetchSpy } = setup()

      await expect(documentLoader('http://example.com/context')).rejects.toThrow('Only https urls are supported')
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    test('uses the redirected url as document url and rejects a redirect to http', async () => {
      const { documentLoader, fetchSpy } = setup()

      fetchSpy.mockResolvedValueOnce(jsonResponse(remoteContext, { url: 'https://example.com/moved' }))
      await expect(documentLoader('https://example.com/context')).resolves.toMatchObject({
        documentUrl: 'https://example.com/moved',
      })

      fetchSpy.mockResolvedValueOnce(jsonResponse(remoteContext, { url: 'http://169.254.169.254/' }))
      await expect(documentLoader('https://example.com/context')).rejects.toThrow('Only https urls are supported')
    })

    test('returns the context from a Link header of a json response', async () => {
      const { documentLoader, fetchSpy } = setup()
      fetchSpy.mockResolvedValue(
        jsonResponse(remoteContext, {
          headers: {
            'content-type': 'application/json',
            link: '<https://example.com/linked>; rel="http://www.w3.org/ns/json-ld#context"',
          },
        })
      )

      await expect(documentLoader('https://example.com/context')).resolves.toMatchObject({
        contextUrl: 'https://example.com/linked',
      })
    })

    test('follows an alternate Link header of a non-json response once', async () => {
      const { documentLoader, fetchSpy } = setup()
      const alternateResponse = () =>
        new Response('<html></html>', {
          headers: {
            'content-type': 'text/html',
            link: '<context.jsonld>; rel="alternate"; type="application/ld+json"',
          },
        })
      fetchSpy.mockResolvedValueOnce(alternateResponse()).mockResolvedValueOnce(jsonResponse(remoteContext))

      await expect(documentLoader('https://example.com/context')).resolves.toMatchObject({
        documentUrl: 'https://example.com/context.jsonld',
        document: remoteContext,
      })

      fetchSpy.mockResolvedValueOnce(alternateResponse()).mockResolvedValueOnce(alternateResponse())
      await expect(documentLoader('https://example.com/context')).rejects.toThrow()
      expect(fetchSpy).toHaveBeenCalledTimes(4)
    })
  })

  // TODO: remove once W3cCredentialsModuleConfig's documentLoader fallback is removed.
  describe('legacy W3cCredentialsModule documentLoader precedence (temporary, to be removed)', () => {
    test('prefers the standalone JsonLdModule document loader over W3cCredentialsModule when both are configured', () => {
      const dependencyManager = new DependencyManager()
      const jsonLdDocumentLoader = vi.fn()
      const w3cDocumentLoader = vi.fn()

      dependencyManager.registerModules({
        jsonLd: new JsonLdModule({ documentLoader: jsonLdDocumentLoader }),
        w3cCredentials: new W3cCredentialsModule({ documentLoader: w3cDocumentLoader }),
      })

      expect(dependencyManager.resolve(JsonLdModuleConfig).documentLoader).toBe(jsonLdDocumentLoader)
      expect(dependencyManager.resolve(W3cCredentialsModuleConfig).documentLoader).toBe(w3cDocumentLoader)
    })

    test('prefers the standalone JsonLdModule document loader even when W3cCredentialsModule is registered first', () => {
      const dependencyManager = new DependencyManager()
      const jsonLdDocumentLoader = vi.fn()
      const w3cDocumentLoader = vi.fn()

      // Reversed registration order
      dependencyManager.registerModules({
        w3cCredentials: new W3cCredentialsModule({ documentLoader: w3cDocumentLoader }),
        jsonLd: new JsonLdModule({ documentLoader: jsonLdDocumentLoader }),
      })

      expect(dependencyManager.resolve(JsonLdModuleConfig).documentLoader).toBe(jsonLdDocumentLoader)
      expect(dependencyManager.resolve(W3cCredentialsModuleConfig).documentLoader).toBe(w3cDocumentLoader)
    })

    test('falls back to W3cCredentialsModule document loader when no standalone JsonLdModule is configured', () => {
      const dependencyManager = new DependencyManager()
      const w3cDocumentLoader = vi.fn()

      dependencyManager.registerModules({
        w3cCredentials: new W3cCredentialsModule({ documentLoader: w3cDocumentLoader }),
      })

      expect(dependencyManager.resolve(JsonLdModuleConfig).documentLoader).toBe(w3cDocumentLoader)
    })
  })
})
