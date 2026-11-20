import type { DependencyManager } from '../../../../../core/src/plugins/DependencyManager'
import { getAgentContext } from '../../../../../core/tests'
import { DidCommFeatureRegistry } from '../../../DidCommFeatureRegistry'
import { DidCommMessageHandlerRegistry } from '../../../DidCommMessageHandlerRegistry'
import { DidCommProtocol } from '../../../models'
import { DidCommCredentialsModule } from '../DidCommCredentialsModule'
import { DidCommCredentialsModuleConfig } from '../DidCommCredentialsModuleConfig'
import { DidCommCredentialV2Protocol } from '../protocol'
import type { DidCommCredentialProtocol } from '../protocol/DidCommCredentialProtocol'
import type { DidCommRevocationNotificationFormatService } from '../protocol/revocation-notification/DidCommRevocationNotificationFormatService'
import { DidCommRevocationNotificationV2Handler } from '../protocol/revocation-notification/handlers'
import { DidCommRevocationNotificationService } from '../protocol/revocation-notification/services'
import { DidCommCredentialExchangeRepository } from '../repository'

const featureRegistry = {
  register: vi.fn(),
} as unknown as DidCommFeatureRegistry

const dependencyManager = {
  registerInstance: vi.fn(),
  registerSingleton: vi.fn(),
  registerContextScoped: vi.fn(),
  resolve: () => featureRegistry,
} as unknown as DependencyManager

describe('CredentialsModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const credentialsModule = new DidCommCredentialsModule({
      credentialProtocols: [],
    })
    credentialsModule.register(dependencyManager)

    expect(dependencyManager.registerInstance).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerInstance).toHaveBeenCalledWith(
      DidCommCredentialsModuleConfig,
      credentialsModule.config
    )

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(2)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidCommRevocationNotificationService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(DidCommCredentialExchangeRepository)
  })

  test('registers DidCommCredentialV2Protocol if no credentialProtocols are configured', () => {
    const credentialsModule = new DidCommCredentialsModule()

    expect(credentialsModule.config.credentialProtocols).toEqual([expect.any(DidCommCredentialV2Protocol)])
  })

  test('calls register on the provided CredentialProtocols', async () => {
    const registerMock = vi.fn()
    const credentialProtocol = {
      register: registerMock,
    } as unknown as DidCommCredentialProtocol

    const credentialsModule = new DidCommCredentialsModule({
      credentialProtocols: [credentialProtocol],
    })

    expect(credentialsModule.config.credentialProtocols).toEqual([credentialProtocol])

    const messageHandlerRegistry = new DidCommMessageHandlerRegistry()
    const agentContext = getAgentContext({
      registerInstances: [
        [DidCommMessageHandlerRegistry, messageHandlerRegistry],
        [DidCommFeatureRegistry, featureRegistry],
        [DidCommRevocationNotificationService, {} as DidCommRevocationNotificationService],
      ],
    })
    await credentialsModule.initialize(agentContext)

    expect(registerMock).toHaveBeenCalledTimes(1)
    expect(registerMock).toHaveBeenCalledWith(messageHandlerRegistry, featureRegistry)

    expect(featureRegistry.register).not.toHaveBeenCalled()
  })

  test.each([undefined, []])(
    'does not register revocation notifications with formats %j',
    async (revocationNotificationFormats) => {
      const credentialsModule = new DidCommCredentialsModule({
        credentialProtocols: [],
        revocationNotificationFormats,
      })
      const messageHandlerRegistry = new DidCommMessageHandlerRegistry()
      const agentContext = getAgentContext({
        registerInstances: [
          [DidCommMessageHandlerRegistry, messageHandlerRegistry],
          [DidCommFeatureRegistry, featureRegistry],
        ],
      })

      await credentialsModule.initialize(agentContext)

      expect(messageHandlerRegistry.supportedMessageTypes).toEqual([])
      expect(featureRegistry.register).not.toHaveBeenCalled()
    }
  )

  test('registers revocation notifications when a format is configured', async () => {
    const formatService: DidCommRevocationNotificationFormatService = {
      supportedRevocationFormats: ['example'],
      findCredentialExchangeRecord: vi.fn(),
      getCredentialId: vi.fn(),
    }
    const credentialsModule = new DidCommCredentialsModule({
      credentialProtocols: [],
      revocationNotificationFormats: [formatService],
    })
    const messageHandlerRegistry = new DidCommMessageHandlerRegistry()
    const agentContext = getAgentContext({
      registerInstances: [
        [DidCommMessageHandlerRegistry, messageHandlerRegistry],
        [DidCommFeatureRegistry, featureRegistry],
        [DidCommRevocationNotificationService, {} as DidCommRevocationNotificationService],
      ],
    })

    await credentialsModule.initialize(agentContext)

    expect(credentialsModule.config.revocationNotificationFormats).toEqual([formatService])
    expect(
      messageHandlerRegistry.getHandlerForMessageType('https://didcomm.org/revocation_notification/2.0/revoke')
    ).toBeInstanceOf(DidCommRevocationNotificationV2Handler)
    expect(featureRegistry.register).toHaveBeenCalledExactlyOnceWith(
      new DidCommProtocol({
        id: 'https://didcomm.org/revocation_notification/2.0',
        roles: ['holder'],
      })
    )
  })
})
