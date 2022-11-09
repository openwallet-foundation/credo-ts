import { CredentialsModuleConfig } from '../CredentialsModuleConfig'
import { AutoAcceptCredential } from '../models'

describe('CredentialsModuleConfig', () => {
  test('sets default values', () => {
    const config = new CredentialsModuleConfig()

    expect(config.autoAcceptCredentials).toBe(AutoAcceptCredential.Never)
  })

  test('sets values', () => {
    const config = new CredentialsModuleConfig({
      autoAcceptCredentials: AutoAcceptCredential.Always,
    })

    expect(config.autoAcceptCredentials).toBe(AutoAcceptCredential.Always)
  })
})
