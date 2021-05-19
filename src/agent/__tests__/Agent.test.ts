import { Agent } from '../Agent'
import { ConnectionsModule } from '../../modules/connections/ConnectionsModule'
import { ProofsModule } from '../../modules/proofs/ProofsModule'
import { CredentialsModule } from '../../modules/credentials/CredentialsModule'
import { BasicMessagesModule } from '../../modules/basic-messages/BasicMessagesModule'
import { LedgerModule } from '../../modules/ledger/LedgerModule'
import { ConnectionRepository, ConnectionService, TrustPingService } from '../../modules/connections'
import { BasicMessageRepository, BasicMessageService } from '../../modules/basic-messages'
import { CredentialRepository, CredentialService } from '../../modules/credentials'
import { ProofRepository, ProofService } from '../../modules/proofs'
import { LedgerService } from '../../modules/ledger'
import { Symbols } from '../../symbols'
import { IndyWallet } from '../../wallet/IndyWallet'
import { InMemoryMessageRepository } from '../../storage/InMemoryMessageRepository'
import { IndyStorageService } from '../../storage/IndyStorageService'
import { MessageSender } from '../MessageSender'
import { MessageReceiver } from '../MessageReceiver'
import { Dispatcher } from '../Dispatcher'
import { EnvelopeService } from '../EnvelopeService'
import { getBaseConfig } from '../../__tests__/helpers'
import {
  MediatorModule,
  RecipientModule,
  MediationRepository,
  MediatorService,
  RecipientService,
} from '../../modules/routing'

const config = getBaseConfig('DI Test')

describe('Agent', () => {
  describe('Dependency Injection', () => {
    it('should be able to resolve registered instances', () => {
      const agent = new Agent(config)
      const container = agent.injectionContainer

      // Modules
      expect(container.resolve(ConnectionsModule)).toBeInstanceOf(ConnectionsModule)
      expect(container.resolve(ConnectionService)).toBeInstanceOf(ConnectionService)
      expect(container.resolve(ConnectionRepository)).toBeInstanceOf(ConnectionRepository)
      expect(container.resolve(TrustPingService)).toBeInstanceOf(TrustPingService)

      expect(container.resolve(ProofsModule)).toBeInstanceOf(ProofsModule)
      expect(container.resolve(ProofService)).toBeInstanceOf(ProofService)
      expect(container.resolve(ProofRepository)).toBeInstanceOf(ProofRepository)

      expect(container.resolve(CredentialsModule)).toBeInstanceOf(CredentialsModule)
      expect(container.resolve(CredentialService)).toBeInstanceOf(CredentialService)
      expect(container.resolve(CredentialRepository)).toBeInstanceOf(CredentialRepository)

      expect(container.resolve(BasicMessagesModule)).toBeInstanceOf(BasicMessagesModule)
      expect(container.resolve(BasicMessageService)).toBeInstanceOf(BasicMessageService)
      expect(container.resolve(BasicMessageRepository)).toBeInstanceOf(BasicMessageRepository)

      expect(container.resolve(MediatorModule)).toBeInstanceOf(MediatorModule)
      expect(container.resolve(RecipientModule)).toBeInstanceOf(RecipientModule)
      expect(container.resolve(MediationRepository)).toBeInstanceOf(MediationRepository)
      expect(container.resolve(MediatorService)).toBeInstanceOf(MediatorService)
      expect(container.resolve(RecipientService)).toBeInstanceOf(RecipientService)

      expect(container.resolve(LedgerModule)).toBeInstanceOf(LedgerModule)
      expect(container.resolve(LedgerService)).toBeInstanceOf(LedgerService)

      // Symbols, interface based
      expect(container.resolve(Symbols.Wallet)).toBeInstanceOf(IndyWallet)
      expect(container.resolve(Symbols.Logger)).toBe(config.logger)
      expect(container.resolve(Symbols.Indy)).toBe(config.indy)
      expect(container.resolve(Symbols.FileSystem)).toBe(config.fileSystem)
      expect(container.resolve(Symbols.StorageService)).toBeInstanceOf(IndyStorageService)
      expect(container.resolve(Symbols.MessageRepository)).toBeInstanceOf(InMemoryMessageRepository)

      // Agent
      expect(container.resolve(MessageSender)).toBeInstanceOf(MessageSender)
      expect(container.resolve(MessageReceiver)).toBeInstanceOf(MessageReceiver)
      expect(container.resolve(Dispatcher)).toBeInstanceOf(Dispatcher)
      expect(container.resolve(EnvelopeService)).toBeInstanceOf(EnvelopeService)
    })

    it('should return the same instance for consequent resolves', () => {
      const agent = new Agent(config)
      const container = agent.injectionContainer

      // Modules
      expect(container.resolve(ConnectionsModule)).toBe(container.resolve(ConnectionsModule))
      expect(container.resolve(ConnectionService)).toBe(container.resolve(ConnectionService))
      expect(container.resolve(ConnectionRepository)).toBe(container.resolve(ConnectionRepository))
      expect(container.resolve(TrustPingService)).toBe(container.resolve(TrustPingService))

      expect(container.resolve(ProofsModule)).toBe(container.resolve(ProofsModule))
      expect(container.resolve(ProofService)).toBe(container.resolve(ProofService))
      expect(container.resolve(ProofRepository)).toBe(container.resolve(ProofRepository))

      expect(container.resolve(CredentialsModule)).toBe(container.resolve(CredentialsModule))
      expect(container.resolve(CredentialService)).toBe(container.resolve(CredentialService))
      expect(container.resolve(CredentialRepository)).toBe(container.resolve(CredentialRepository))

      expect(container.resolve(BasicMessagesModule)).toBe(container.resolve(BasicMessagesModule))
      expect(container.resolve(BasicMessageService)).toBe(container.resolve(BasicMessageService))
      expect(container.resolve(BasicMessageRepository)).toBe(container.resolve(BasicMessageRepository))

      expect(container.resolve(MediatorModule)).toBe(container.resolve(MediatorModule))
      expect(container.resolve(RecipientModule)).toBe(container.resolve(RecipientModule))
      expect(container.resolve(MediationRepository)).toBe(container.resolve(MediationRepository))
      expect(container.resolve(MediatorService)).toBe(container.resolve(MediatorService))
      expect(container.resolve(RecipientService)).toBe(container.resolve(RecipientService))

      expect(container.resolve(LedgerModule)).toBe(container.resolve(LedgerModule))
      expect(container.resolve(LedgerService)).toBe(container.resolve(LedgerService))

      // Symbols, interface based
      expect(container.resolve(Symbols.Wallet)).toBe(container.resolve(Symbols.Wallet))
      expect(container.resolve(Symbols.FileSystem)).toBe(container.resolve(Symbols.FileSystem))
      expect(container.resolve(Symbols.Logger)).toBe(container.resolve(Symbols.Logger))
      expect(container.resolve(Symbols.Indy)).toBe(container.resolve(Symbols.Indy))
      expect(container.resolve(Symbols.MessageRepository)).toBe(container.resolve(Symbols.MessageRepository))
      expect(container.resolve(Symbols.StorageService)).toBe(container.resolve(Symbols.StorageService))

      // Agent
      expect(container.resolve(MessageSender)).toBe(container.resolve(MessageSender))
      expect(container.resolve(MessageReceiver)).toBe(container.resolve(MessageReceiver))
      expect(container.resolve(Dispatcher)).toBe(container.resolve(Dispatcher))
      expect(container.resolve(EnvelopeService)).toBe(container.resolve(EnvelopeService))
    })
  })
})
