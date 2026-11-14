import { Agent, DependencyManager, EventEmitter, InjectionSymbols } from '@credo-ts/core'
import {
  DidCommCredentialExchangeRepository,
  DidCommCredentialsModuleConfig,
  DidCommFeatureRegistry,
  DidCommInboundMessageContext,
  DidCommMessageHandlerRegistry,
  DidCommModule,
  DidCommProtocol,
} from '@credo-ts/didcomm'
import { Subject } from 'rxjs'
import { InMemoryStorageService } from '../../../../../tests/InMemoryStorageService'
import { getAgentConfig, getAgentContext } from '../../../../core/tests/helpers'
import { AnonCredsDidCommRevocationNotificationModule } from '../AnonCredsDidCommRevocationNotificationModule'
import { AnonCredsRevocationNotificationProcessor } from '../AnonCredsRevocationNotificationProcessor'
import {
  DidCommRevocationNotificationV1Message,
  DidCommRevocationNotificationV2Message,
} from '../revocation-notification/messages'

describe('AnonCredsDidCommRevocationNotificationModule', () => {
  test.each(['v1', 'v2'])(
    'registers discovery and dispatches %s messages to the AnonCreds processor',
    async (version) => {
      const config = getAgentConfig('AnonCredsDidCommRevocationNotificationModule')
      const eventEmitter = new EventEmitter(config.agentDependencies, new Subject())
      const featureRegistry = new DidCommFeatureRegistry()
      const registerFeatures = vi.spyOn(featureRegistry, 'register')
      const messageHandlerRegistry = new DidCommMessageHandlerRegistry()
      const agentContext = getAgentContext({
        registerInstances: [
          [InjectionSymbols.Logger, config.logger],
          [EventEmitter, eventEmitter],
          [DidCommCredentialsModuleConfig, new DidCommCredentialsModuleConfig({ credentialProtocols: [] })],
          [
            DidCommCredentialExchangeRepository,
            new DidCommCredentialExchangeRepository(new InMemoryStorageService(), eventEmitter),
          ],
          [DidCommFeatureRegistry, featureRegistry],
          [DidCommMessageHandlerRegistry, messageHandlerRegistry],
        ],
      })
      const module = new AnonCredsDidCommRevocationNotificationModule()
      module.register(agentContext.dependencyManager)
      await module.initialize(agentContext)

      expect(registerFeatures).toHaveBeenCalledWith(
        new DidCommProtocol({ id: 'https://didcomm.org/revocation_notification/1.0', roles: ['holder'] }),
        new DidCommProtocol({ id: 'https://didcomm.org/revocation_notification/2.0', roles: ['holder'] })
      )

      const processor = agentContext.dependencyManager.resolve(AnonCredsRevocationNotificationProcessor)
      const processV1 = vi.spyOn(processor, 'processV1').mockResolvedValue()
      const processV2 = vi.spyOn(processor, 'processV2').mockResolvedValue()
      const message =
        version === 'v1'
          ? new DidCommRevocationNotificationV1Message({ issueThread: 'opaque-thread' })
          : new DidCommRevocationNotificationV2Message({ credentialId: 'opaque-id', revocationFormat: 'anoncreds' })
      const messageContext = new DidCommInboundMessageContext(message, { agentContext })
      const handler = messageHandlerRegistry.getHandlerForMessageType(message.type)
      expect(handler).toBeDefined()
      await handler?.handle(messageContext)

      expect(version === 'v1' ? processV1 : processV2).toHaveBeenCalledWith(messageContext)
      expect(version === 'v1' ? processV2 : processV1).not.toHaveBeenCalled()
    }
  )

  test('constructs the agent but rejects initialization clearly when DIDComm credentials are disabled', async () => {
    const config = getAgentConfig('RevocationNotificationWithoutCredentials')
    const dependencyManager = new DependencyManager()
    const storage = new InMemoryStorageService()
    dependencyManager.registerInstance(InjectionSymbols.StorageService, storage)
    const agent = new Agent(
      {
        dependencies: config.agentDependencies,
        modules: {
          didcomm: new DidCommModule({ credentials: false }),
          revocationNotification: new AnonCredsDidCommRevocationNotificationModule(),
        },
      },
      dependencyManager
    )
    storage.createRecordsForContext(agent.context)

    try {
      await expect(agent.initialize()).rejects.toMatchObject({
        cause: expect.objectContaining({
          message: 'AnonCredsDidCommRevocationNotificationModule requires DIDComm credentials to be enabled.',
        }),
      })
      const handlers = agent.dependencyManager.resolve(DidCommMessageHandlerRegistry)
      expect(
        handlers.getHandlerForMessageType(DidCommRevocationNotificationV1Message.type.messageTypeUri)
      ).toBeUndefined()
      expect(
        handlers.getHandlerForMessageType(DidCommRevocationNotificationV2Message.type.messageTypeUri)
      ).toBeUndefined()
      expect(
        agent.dependencyManager.resolve(DidCommFeatureRegistry).query({
          featureType: 'protocol',
          match: 'https://didcomm.org/revocation_notification/*',
        })
      ).toHaveLength(0)
    } finally {
      await agent.shutdown()
    }
  })
})
