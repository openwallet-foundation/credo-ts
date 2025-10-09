import { W3cCredentialsModuleConfig } from '../W3cCredentialsModuleConfig'
import { defaultDocumentLoader } from '../data-integrity/libraries/documentLoader'

describe('W3cCredentialsModuleConfig', () => {
  test('sets default values', () => {
    const config = new W3cCredentialsModuleConfig()

    expect(config.documentLoader).toBe(defaultDocumentLoader)
  })

  test('sets values', () => {
    const documentLoader = vi.fn()
    const config = new W3cCredentialsModuleConfig({
      documentLoader,
    })

    expect(config.documentLoader).toBe(documentLoader)
  })
})
