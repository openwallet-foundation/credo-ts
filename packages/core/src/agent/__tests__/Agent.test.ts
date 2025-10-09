import type { Module } from '../../plugins'

import { injectable } from 'tsyringe'

import { InMemoryWalletModule } from '../../../../../tests/InMemoryWalletModule'
import {
  DidCommBasicMessageRepository,
  DidCommBasicMessageService,
  DidCommConnectionService,
  DidCommDidRotateService,
  DidCommDispatcher,
  DidCommEnvelopeService,
  DidCommFeatureRegistry,
  DidCommMessageReceiver,
  DidCommMessageSender,
  DidCommModule,
  DidCommTrustPingService,
} from '../../../../didcomm/src'
import { DidCommBasicMessagesApi } from '../../../../didcomm/src/modules/basic-messages/DidCommBasicMessagesApi'
import { DidCommConnectionRepository, DidCommConnectionsApi } from '../../../../didcomm/src/modules/connections'
import { DidCommCredentialExchangeRepository } from '../../../../didcomm/src/modules/credentials'
import { DidCommCredentialsApi } from '../../../../didcomm/src/modules/credentials/DidCommCredentialsApi'
import { DidCommMessagePickupApi } from '../../../../didcomm/src/modules/message-pickup'
import { DidCommProofExchangeRepository, DidCommProofsApi } from '../../../../didcomm/src/modules/proofs'
import {
  DidCommMediationRecipientApi,
  DidCommMediationRecipientService,
  DidCommMediationRepository,
  DidCommMediatorApi,
  DidCommMediatorService,
} from '../../../../didcomm/src/modules/routing'
import { getAgentOptions } from '../../../tests/helpers'
import { InjectionSymbols } from '../../constants'
import { Agent } from '../Agent'

const agentOptions = getAgentOptions('Agent Class Test', undefined, undefined, undefined, { requireDidcomm: true })

const myModuleMethod = jest.fn()
@injectable()
class MyApi {
  public myModuleMethod = myModuleMethod
}

class MyModule implements Module {
  public api = MyApi
  public register() {
    // noop
  }
}

describe('Agent', () => {
  describe('Module registration', () => {
    test('does not return default modules on modules key if no modules were provided', () => {
      const agent = new Agent({
        ...agentOptions,
        modules: {
          inMemory: new InMemoryWalletModule(),
        },
      })

      expect(agent.modules).toEqual({})
    })
    test('registers custom and default modules if custom modules are provided', () => {
      const agent = new Agent({
        ...agentOptions,
        modules: {
          myModule: new MyModule(),
          inMemory: new InMemoryWalletModule(),
        },
      })

      expect(agent.modules.myModule.myModuleMethod).toBe(myModuleMethod)
      expect(agent.modules).toEqual({
        myModule: expect.any(MyApi),
      })
    })

    test('override default module configuration', () => {
      const agent = new Agent({
        ...agentOptions,
        modules: {
          didcomm: new DidCommModule({
            mediationRecipient: {
              maximumMessagePickup: 42,
            },
          }),
          myModule: new MyModule(),
          inMemory: new InMemoryWalletModule(),
        },
      })

      // Should be custom module config property, not the default value
      expect(agent.didcomm.mediationRecipient.config.maximumMessagePickup).toBe(42)
      expect(agent.modules.myModule).toEqual(expect.any(MyApi))
    })
  })

  describe('Initialization', () => {
    let agent: Agent

    it('isInitialized should only return true after initialization', async () => {
      expect.assertions(2)

      agent = new Agent(agentOptions)

      expect(agent.isInitialized).toBe(false)
      await agent.initialize()
      expect(agent.isInitialized).toBe(true)
    })
  })

  describe('Dependency Injection', () => {
    it('should be able to resolve registered instances', () => {
      const agent = new Agent(agentOptions)
      const container = agent.dependencyManager

      // Modules
      expect(container.resolve(DidCommConnectionsApi)).toBeInstanceOf(DidCommConnectionsApi)
      expect(container.resolve(DidCommConnectionService)).toBeInstanceOf(DidCommConnectionService)
      expect(container.resolve(DidCommConnectionRepository)).toBeInstanceOf(DidCommConnectionRepository)
      expect(container.resolve(DidCommDidRotateService)).toBeInstanceOf(DidCommDidRotateService)
      expect(container.resolve(DidCommTrustPingService)).toBeInstanceOf(DidCommTrustPingService)

      expect(container.resolve(DidCommProofsApi)).toBeInstanceOf(DidCommProofsApi)
      expect(container.resolve(DidCommProofExchangeRepository)).toBeInstanceOf(DidCommProofExchangeRepository)

      expect(container.resolve(DidCommCredentialsApi)).toBeInstanceOf(DidCommCredentialsApi)
      expect(container.resolve(DidCommCredentialExchangeRepository)).toBeInstanceOf(DidCommCredentialExchangeRepository)

      expect(container.resolve(DidCommBasicMessagesApi)).toBeInstanceOf(DidCommBasicMessagesApi)
      expect(container.resolve(DidCommBasicMessageService)).toBeInstanceOf(DidCommBasicMessageService)
      expect(container.resolve(DidCommBasicMessageRepository)).toBeInstanceOf(DidCommBasicMessageRepository)

      expect(container.resolve(DidCommMediatorApi)).toBeInstanceOf(DidCommMediatorApi)
      expect(container.resolve(DidCommMediationRecipientApi)).toBeInstanceOf(DidCommMediationRecipientApi)
      expect(container.resolve(DidCommMessagePickupApi)).toBeInstanceOf(DidCommMessagePickupApi)
      expect(container.resolve(DidCommMediationRepository)).toBeInstanceOf(DidCommMediationRepository)
      expect(container.resolve(DidCommMediatorService)).toBeInstanceOf(DidCommMediatorService)
      expect(container.resolve(DidCommMediationRecipientService)).toBeInstanceOf(DidCommMediationRecipientService)

      // Symbols, interface based
      expect(container.resolve(InjectionSymbols.Logger)).toBe(agentOptions.config.logger)

      // Agent
      expect(container.resolve(DidCommMessageSender)).toBeInstanceOf(DidCommMessageSender)
      expect(container.resolve(DidCommMessageReceiver)).toBeInstanceOf(DidCommMessageReceiver)
      expect(container.resolve(DidCommDispatcher)).toBeInstanceOf(DidCommDispatcher)
      expect(container.resolve(DidCommEnvelopeService)).toBeInstanceOf(DidCommEnvelopeService)
    })

    it('should return the same instance for consequent resolves', () => {
      const agent = new Agent(agentOptions)
      const container = agent.dependencyManager

      // Modules
      expect(container.resolve(DidCommConnectionsApi)).toBe(container.resolve(DidCommConnectionsApi))
      expect(container.resolve(DidCommConnectionService)).toBe(container.resolve(DidCommConnectionService))
      expect(container.resolve(DidCommConnectionRepository)).toBe(container.resolve(DidCommConnectionRepository))
      expect(container.resolve(DidCommTrustPingService)).toBe(container.resolve(DidCommTrustPingService))
      expect(container.resolve(DidCommDidRotateService)).toBe(container.resolve(DidCommDidRotateService))

      expect(container.resolve(DidCommProofsApi)).toBe(container.resolve(DidCommProofsApi))
      expect(container.resolve(DidCommProofExchangeRepository)).toBe(container.resolve(DidCommProofExchangeRepository))

      expect(container.resolve(DidCommCredentialsApi)).toBe(container.resolve(DidCommCredentialsApi))
      expect(container.resolve(DidCommCredentialExchangeRepository)).toBe(
        container.resolve(DidCommCredentialExchangeRepository)
      )

      expect(container.resolve(DidCommBasicMessagesApi)).toBe(container.resolve(DidCommBasicMessagesApi))
      expect(container.resolve(DidCommBasicMessageService)).toBe(container.resolve(DidCommBasicMessageService))
      expect(container.resolve(DidCommBasicMessageRepository)).toBe(container.resolve(DidCommBasicMessageRepository))

      expect(container.resolve(DidCommMediatorApi)).toBe(container.resolve(DidCommMediatorApi))
      expect(container.resolve(DidCommMediationRecipientApi)).toBe(container.resolve(DidCommMediationRecipientApi))
      expect(container.resolve(DidCommMessagePickupApi)).toBe(container.resolve(DidCommMessagePickupApi))
      expect(container.resolve(DidCommMediationRepository)).toBe(container.resolve(DidCommMediationRepository))
      expect(container.resolve(DidCommMediatorService)).toBe(container.resolve(DidCommMediatorService))
      expect(container.resolve(DidCommMediationRecipientService)).toBe(
        container.resolve(DidCommMediationRecipientService)
      )

      // Symbols, interface based
      expect(container.resolve(InjectionSymbols.Logger)).toBe(container.resolve(InjectionSymbols.Logger))
      expect(container.resolve(InjectionSymbols.StorageService)).toBe(
        container.resolve(InjectionSymbols.StorageService)
      )

      // Agent
      expect(container.resolve(DidCommMessageSender)).toBe(container.resolve(DidCommMessageSender))
      expect(container.resolve(DidCommMessageReceiver)).toBe(container.resolve(DidCommMessageReceiver))
      expect(container.resolve(DidCommDispatcher)).toBe(container.resolve(DidCommDispatcher))
      expect(container.resolve(DidCommFeatureRegistry)).toBe(container.resolve(DidCommFeatureRegistry))
      expect(container.resolve(DidCommEnvelopeService)).toBe(container.resolve(DidCommEnvelopeService))
    })
  })

  it('all core features are properly registered', async () => {
    const agent = new Agent(agentOptions)
    await agent.initialize() // Initialization is needed to properly register DIDComm features
    const registry = agent.dependencyManager.resolve(DidCommFeatureRegistry)

    const protocols = registry.query({ featureType: 'protocol', match: '*' }).map((p) => p.id)

    expect(protocols.length).toEqual(14)

    expect(protocols).toEqual(
      expect.arrayContaining([
        'https://didcomm.org/basicmessage/1.0',
        'https://didcomm.org/connections/1.0',
        'https://didcomm.org/coordinate-mediation/1.0',
        'https://didcomm.org/issue-credential/2.0',
        'https://didcomm.org/present-proof/2.0',
        'https://didcomm.org/didexchange/1.1',
        'https://didcomm.org/did-rotate/1.0',
        'https://didcomm.org/discover-features/1.0',
        'https://didcomm.org/discover-features/2.0',
        'https://didcomm.org/messagepickup/1.0',
        'https://didcomm.org/messagepickup/2.0',
        'https://didcomm.org/out-of-band/1.1',
        'https://didcomm.org/revocation_notification/1.0',
        'https://didcomm.org/revocation_notification/2.0',
      ])
    )
  })
})
