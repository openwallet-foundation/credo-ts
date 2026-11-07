import { W3cCredentialsModuleConfig } from '../W3cCredentialsModuleConfig'

describe('W3cCredentialsModuleConfig', () => {
  test('sets values', () => {
    const documentLoader = vi.fn()
    const config = new W3cCredentialsModuleConfig({
      documentLoader,
    })

    expect(config.documentLoader).toBe(documentLoader)
  })
})
