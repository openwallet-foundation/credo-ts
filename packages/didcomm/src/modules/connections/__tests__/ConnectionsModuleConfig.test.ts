import { DidCommConnectionsModuleConfig } from '../DidCommConnectionsModuleConfig'

describe('ConnectionsModuleConfig', () => {
  test('sets default values', () => {
    const config = new DidCommConnectionsModuleConfig()

    expect(config.autoAcceptConnections).toBe(false)
  })

  test('sets values', () => {
    const config = new DidCommConnectionsModuleConfig({
      autoAcceptConnections: true,
    })

    expect(config.autoAcceptConnections).toBe(true)
  })
})
