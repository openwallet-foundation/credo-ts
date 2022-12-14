import { W3cVcModuleConfig } from '../W3cVcModuleConfig'
import { defaultDocumentLoader } from '../libraries/documentLoader'

describe('W3cVcModuleConfig', () => {
  test('sets default values', () => {
    const config = new W3cVcModuleConfig()

    expect(config.documentLoader).toBe(defaultDocumentLoader)
  })

  test('sets values', () => {
    const documentLoader = jest.fn()
    const config = new W3cVcModuleConfig({
      documentLoader,
    })

    expect(config.documentLoader).toBe(documentLoader)
  })
})
