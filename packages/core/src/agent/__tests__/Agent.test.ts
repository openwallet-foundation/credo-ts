import type { DependencyManager, Module } from '../../plugins'

import { injectable } from 'tsyringe'

import { getIndySdkModules } from '../../../../indy-sdk/tests/setupIndySdkModule'
import { getAgentOptions } from '../../../tests/helpers'
import { InjectionSymbols } from '../../constants'
import { BasicMessageRepository, BasicMessageService } from '../../modules/basic-messages'
import { BasicMessagesApi } from '../../modules/basic-messages/BasicMessagesApi'
import { ConnectionsApi } from '../../modules/connections/ConnectionsApi'
import { ConnectionRepository } from '../../modules/connections/repository/ConnectionRepository'
import { ConnectionService } from '../../modules/connections/services/ConnectionService'
import { TrustPingService } from '../../modules/connections/services/TrustPingService'
import { CredentialRepository } from '../../modules/credentials'
import { CredentialsApi } from '../../modules/credentials/CredentialsApi'
import { ProofRepository } from '../../modules/proofs'
import { ProofsApi } from '../../modules/proofs/ProofsApi'
import {
  MediationRecipientService,
  MediationRepository,
  MediatorApi,
  MediatorService,
  RecipientApi,
  RecipientModule,
} from '../../modules/routing'
import { InMemoryMessageRepository } from '../../storage/InMemoryMessageRepository'
import { WalletError } from '../../wallet/error'
import { Agent } from '../Agent'
import { Dispatcher } from '../Dispatcher'
import { EnvelopeService } from '../EnvelopeService'
import { FeatureRegistry } from '../FeatureRegistry'
import { MessageReceiver } from '../MessageReceiver'
import { MessageSender } from '../MessageSender'

const agentOptions = getAgentOptions('Agent Class Test', {}, getIndySdkModules())

const myModuleMethod = jest.fn()
@injectable()
class MyApi {
  public myModuleMethod = myModuleMethod
}

class MyModule implements Module {
  public api = MyApi
  public register(dependencyManager: DependencyManager) {
    dependencyManager.registerContextScoped(MyApi)
  }
}

describe('Agent', () => {
  describe('Module registration', () => {
    test('does not return default modules on modules key if no modules were provided', () => {
      const agent = new Agent(agentOptions)

      expect(agent.modules).toEqual({})
    })

    test('registers custom and default modules if custom modules are provided', () => {
      const agent = new Agent({
        ...agentOptions,
        modules: {
          myModule: new MyModule(),
          ...getIndySdkModules(),
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
          myModule: new MyModule(),
          mediationRecipient: new RecipientModule({
            maximumMessagePickup: 42,
          }),
          ...getIndySdkModules(),
        },
      })

      // Should be custom module config property, not the default value
      expect(agent.mediationRecipient.config.maximumMessagePickup).toBe(42)
      expect(agent.modules).toEqual({
        myModule: expect.any(MyApi),
      })
    })
  })

  describe('Initialization', () => {
    let agent: Agent

    afterEach(async () => {
      const wallet = agent.context.wallet

      if (wallet.isInitialized) {
        await wallet.delete()
      }
    })

    it('isInitialized should only return true after initialization', async () => {
      expect.assertions(2)

      agent = new Agent(agentOptions)

      expect(agent.isInitialized).toBe(false)
      await agent.initialize()
      expect(agent.isInitialized).toBe(true)
    })

    it('wallet isInitialized should return true after agent initialization if wallet config is set in agent constructor', async () => {
      expect.assertions(4)

      agent = new Agent(agentOptions)
      const wallet = agent.context.wallet

      expect(agent.isInitialized).toBe(false)
      expect(wallet.isInitialized).toBe(false)
      await agent.initialize()
      expect(agent.isInitialized).toBe(true)
      expect(wallet.isInitialized).toBe(true)
    })

    it('wallet must be initialized if wallet config is not set before agent can be initialized', async () => {
      expect.assertions(9)

      const { walletConfig, ...withoutWalletConfig } = agentOptions.config
      agent = new Agent({ ...agentOptions, config: withoutWalletConfig })

      expect(agent.isInitialized).toBe(false)
      expect(agent.wallet.isInitialized).toBe(false)

      expect(agent.initialize()).rejects.toThrowError(WalletError)
      expect(agent.isInitialized).toBe(false)
      expect(agent.wallet.isInitialized).toBe(false)

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await agent.wallet.initialize(walletConfig!)
      expect(agent.isInitialized).toBe(false)
      expect(agent.wallet.isInitialized).toBe(true)

      await agent.initialize()
      expect(agent.wallet.isInitialized).toBe(true)
      expect(agent.isInitialized).toBe(true)
    })
  })

  describe('Dependency Injection', () => {
    it('should be able to resolve registered instances', () => {
      const agent = new Agent(agentOptions)
      const container = agent.dependencyManager

      // Modules
      expect(container.resolve(ConnectionsApi)).toBeInstanceOf(ConnectionsApi)
      expect(container.resolve(ConnectionService)).toBeInstanceOf(ConnectionService)
      expect(container.resolve(ConnectionRepository)).toBeInstanceOf(ConnectionRepository)
      expect(container.resolve(TrustPingService)).toBeInstanceOf(TrustPingService)

      expect(container.resolve(ProofsApi)).toBeInstanceOf(ProofsApi)
      expect(container.resolve(ProofRepository)).toBeInstanceOf(ProofRepository)

      expect(container.resolve(CredentialsApi)).toBeInstanceOf(CredentialsApi)
      expect(container.resolve(CredentialRepository)).toBeInstanceOf(CredentialRepository)

      expect(container.resolve(BasicMessagesApi)).toBeInstanceOf(BasicMessagesApi)
      expect(container.resolve(BasicMessageService)).toBeInstanceOf(BasicMessageService)
      expect(container.resolve(BasicMessageRepository)).toBeInstanceOf(BasicMessageRepository)

      expect(container.resolve(MediatorApi)).toBeInstanceOf(MediatorApi)
      expect(container.resolve(RecipientApi)).toBeInstanceOf(RecipientApi)
      expect(container.resolve(MediationRepository)).toBeInstanceOf(MediationRepository)
      expect(container.resolve(MediatorService)).toBeInstanceOf(MediatorService)
      expect(container.resolve(MediationRecipientService)).toBeInstanceOf(MediationRecipientService)

      // Symbols, interface based
      expect(container.resolve(InjectionSymbols.Logger)).toBe(agentOptions.config.logger)
      expect(container.resolve(InjectionSymbols.MessageRepository)).toBeInstanceOf(InMemoryMessageRepository)

      // Agent
      expect(container.resolve(MessageSender)).toBeInstanceOf(MessageSender)
      expect(container.resolve(MessageReceiver)).toBeInstanceOf(MessageReceiver)
      expect(container.resolve(Dispatcher)).toBeInstanceOf(Dispatcher)
      expect(container.resolve(EnvelopeService)).toBeInstanceOf(EnvelopeService)
    })

    it('should return the same instance for consequent resolves', () => {
      const agent = new Agent(agentOptions)
      const container = agent.dependencyManager

      // Modules
      expect(container.resolve(ConnectionsApi)).toBe(container.resolve(ConnectionsApi))
      expect(container.resolve(ConnectionService)).toBe(container.resolve(ConnectionService))
      expect(container.resolve(ConnectionRepository)).toBe(container.resolve(ConnectionRepository))
      expect(container.resolve(TrustPingService)).toBe(container.resolve(TrustPingService))

      expect(container.resolve(ProofsApi)).toBe(container.resolve(ProofsApi))
      expect(container.resolve(ProofRepository)).toBe(container.resolve(ProofRepository))

      expect(container.resolve(CredentialsApi)).toBe(container.resolve(CredentialsApi))
      expect(container.resolve(CredentialRepository)).toBe(container.resolve(CredentialRepository))

      expect(container.resolve(BasicMessagesApi)).toBe(container.resolve(BasicMessagesApi))
      expect(container.resolve(BasicMessageService)).toBe(container.resolve(BasicMessageService))
      expect(container.resolve(BasicMessageRepository)).toBe(container.resolve(BasicMessageRepository))

      expect(container.resolve(MediatorApi)).toBe(container.resolve(MediatorApi))
      expect(container.resolve(RecipientApi)).toBe(container.resolve(RecipientApi))
      expect(container.resolve(MediationRepository)).toBe(container.resolve(MediationRepository))
      expect(container.resolve(MediatorService)).toBe(container.resolve(MediatorService))
      expect(container.resolve(MediationRecipientService)).toBe(container.resolve(MediationRecipientService))

      // Symbols, interface based
      expect(container.resolve(InjectionSymbols.Logger)).toBe(container.resolve(InjectionSymbols.Logger))
      expect(container.resolve(InjectionSymbols.MessageRepository)).toBe(
        container.resolve(InjectionSymbols.MessageRepository)
      )
      expect(container.resolve(InjectionSymbols.StorageService)).toBe(
        container.resolve(InjectionSymbols.StorageService)
      )

      // Agent
      expect(container.resolve(MessageSender)).toBe(container.resolve(MessageSender))
      expect(container.resolve(MessageReceiver)).toBe(container.resolve(MessageReceiver))
      expect(container.resolve(Dispatcher)).toBe(container.resolve(Dispatcher))
      expect(container.resolve(FeatureRegistry)).toBe(container.resolve(FeatureRegistry))
      expect(container.resolve(EnvelopeService)).toBe(container.resolve(EnvelopeService))
    })
  })

  it('all core features are properly registered', () => {
    const agent = new Agent(agentOptions)
    const registry = agent.dependencyManager.resolve(FeatureRegistry)

    const protocols = registry.query({ featureType: 'protocol', match: '*' }).map((p) => p.id)

    expect(protocols).toEqual(
      expect.arrayContaining([
        'https://didcomm.org/basicmessage/1.0',
        'https://didcomm.org/connections/1.0',
        'https://didcomm.org/coordinate-mediation/1.0',
        'https://didcomm.org/issue-credential/2.0',
        'https://didcomm.org/present-proof/2.0',
        'https://didcomm.org/didexchange/1.0',
        'https://didcomm.org/discover-features/1.0',
        'https://didcomm.org/discover-features/2.0',
        'https://didcomm.org/messagepickup/1.0',
        'https://didcomm.org/messagepickup/2.0',
        'https://didcomm.org/out-of-band/1.1',
        'https://didcomm.org/revocation_notification/1.0',
        'https://didcomm.org/revocation_notification/2.0',
      ])
    )
    expect(protocols.length).toEqual(13)
  })
})
