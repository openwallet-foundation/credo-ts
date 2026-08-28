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
})
