import type { DidCommCredentialProtocol } from '../protocol/DidCommCredentialProtocol'

import { DidCommCredentialsModuleConfig } from '../DidCommCredentialsModuleConfig'
import { DidCommAutoAcceptCredential } from '../models'

describe('CredentialsModuleConfig', () => {
  test('sets default values', () => {
    const config = new DidCommCredentialsModuleConfig({
      credentialProtocols: [],
    })

    expect(config.autoAcceptCredentials).toBe(DidCommAutoAcceptCredential.Never)
    expect(config.credentialProtocols).toEqual([])
  })

  test('sets values', () => {
    const credentialProtocol = vi.fn() as unknown as DidCommCredentialProtocol
    const config = new DidCommCredentialsModuleConfig({
      autoAcceptCredentials: DidCommAutoAcceptCredential.Always,
      credentialProtocols: [credentialProtocol],
    })

    expect(config.autoAcceptCredentials).toBe(DidCommAutoAcceptCredential.Always)
    expect(config.credentialProtocols).toEqual([credentialProtocol])
  })
})
