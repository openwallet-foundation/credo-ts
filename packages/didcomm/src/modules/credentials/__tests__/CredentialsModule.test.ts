import type { DependencyManager } from '../../../../../core/src/plugins/DependencyManager'
import type { CredentialProtocol } from '../protocol/CredentialProtocol'

import { getAgentContext } from '../../../../../core/tests'
import { DidCommFeatureRegistry } from '../../../DidCommFeatureRegistry'
import { DidCommMessageHandlerRegistry } from '../../../DidCommMessageHandlerRegistry'
import { DidCommProtocol } from '../../../models'
import { CredentialsModule } from '../CredentialsModule'
import { CredentialsModuleConfig } from '../CredentialsModuleConfig'
import { V2CredentialProtocol } from '../protocol'
import { RevocationNotificationService } from '../protocol/revocation-notification/services'
import { CredentialRepository } from '../repository'

const featureRegistry = {
  register: jest.fn(),
} as unknown as DidCommFeatureRegistry

const dependencyManager = {
  registerInstance: jest.fn(),
  registerSingleton: jest.fn(),
  registerContextScoped: jest.fn(),
  resolve: () => featureRegistry,
} as unknown as DependencyManager

describe('CredentialsModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const credentialsModule = new CredentialsModule({
      credentialProtocols: [],
    })
    credentialsModule.register(dependencyManager)

    expect(dependencyManager.registerInstance).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerInstance).toHaveBeenCalledWith(CredentialsModuleConfig, credentialsModule.config)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(2)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(RevocationNotificationService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(CredentialRepository)
  })

  test('registers V2CredentialProtocol if no credentialProtocols are configured', () => {
    const credentialsModule = new CredentialsModule()

    expect(credentialsModule.config.credentialProtocols).toEqual([expect.any(V2CredentialProtocol)])
  })

  test('calls register on the provided CredentialProtocols', async () => {
    const registerMock = jest.fn()
    const credentialProtocol = {
      register: registerMock,
    } as unknown as CredentialProtocol

    const credentialsModule = new CredentialsModule({
      credentialProtocols: [credentialProtocol],
    })

    expect(credentialsModule.config.credentialProtocols).toEqual([credentialProtocol])

    const messageHandlerRegistry = new DidCommMessageHandlerRegistry()
    const agentContext = getAgentContext({
      registerInstances: [
        [DidCommMessageHandlerRegistry, messageHandlerRegistry],
        [DidCommFeatureRegistry, featureRegistry],
      ],
    })
    await credentialsModule.initialize(agentContext)

    expect(registerMock).toHaveBeenCalledTimes(1)
    expect(registerMock).toHaveBeenCalledWith(messageHandlerRegistry, featureRegistry)

    expect(featureRegistry.register).toHaveBeenCalledTimes(1)
    expect(featureRegistry.register).toHaveBeenCalledWith(
      new DidCommProtocol({
        id: 'https://didcomm.org/revocation_notification/1.0',
        roles: ['holder'],
      }),
      new DidCommProtocol({
        id: 'https://didcomm.org/revocation_notification/2.0',
        roles: ['holder'],
      })
    )
  })
})
