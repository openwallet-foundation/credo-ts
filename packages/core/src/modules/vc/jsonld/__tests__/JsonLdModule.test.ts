import { DependencyManager } from '../../../../plugins/DependencyManager'
import { W3cCredentialsModule } from '../../W3cCredentialsModule'
import { W3cCredentialsModuleConfig } from '../../W3cCredentialsModuleConfig'
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
