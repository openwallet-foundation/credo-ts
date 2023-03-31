import { W3cCredentialsModuleConfig } from '../W3cCredentialsModuleConfig'
import { defaultDocumentLoader } from '../libraries/documentLoader'

describe('W3cVcModuleConfig', () => {
  test('sets default values', () => {
    const config = new W3cCredentialsModuleConfig()

    expect(config.documentLoader).toBe(defaultDocumentLoader)
  })

  test('sets values', () => {
    const documentLoader = jest.fn()
    const config = new W3cCredentialsModuleConfig({
      documentLoader,
    })

    expect(config.documentLoader).toBe(documentLoader)
  })
})
