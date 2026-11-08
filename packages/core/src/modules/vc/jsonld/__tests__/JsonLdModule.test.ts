import { getAgentConfig, getAgentContext } from '../../../../../tests/helpers'
import { DependencyManager } from '../../../../plugins/DependencyManager'
import { DidResolverService } from '../../../dids'
import { SECURITY_ED25519_2018_CONTEXT_URL, SECURITY_ED25519_2020_CONTEXT_URL } from '../../constants'
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
})
