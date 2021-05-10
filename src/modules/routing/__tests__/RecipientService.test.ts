import indy from 'indy-sdk'
import { MediationRecord, MediationTags, MediationStorageProps, MediationRole, MediationState } from '..'
import { RecipientService } from '../services/RecipientService'
import { Repository } from '../../../storage/Repository'
import type { Verkey } from 'indy-sdk'
import { assert } from 'console'
import { ConnectionRecord, ConnectionService, InitConfig } from '../../..'
import { AgentConfig } from '../../../agent/AgentConfig'
import { MessageSender } from '../../../agent/MessageSender'
import { IndyWallet } from '../../../wallet/IndyWallet'
import { Wallet } from '../../../wallet/Wallet'
import testLogger from '../../../__tests__/logger'
jest.mock('../services/RecipientService')
jest.mock('./../../../storage/Repository')
const MediationRepository = <jest.Mock<Repository<MediationRecord>>>(<unknown>Repository)

describe('Recipient', () => {
  const walletConfig = { id: 'test-wallet' + '-RecipientServiceTest' }
  const walletCredentials = { key: 'key' }
  const initConfig: InitConfig = {
    label: 'agent label',
    host: 'http://agent.com',
    port: 8080,
    walletConfig,
    walletCredentials,
    indy,
    logger: testLogger,
  }

  let wallet: Wallet
  let agentConfig: AgentConfig
  let mediationRepository: Repository<MediationRecord>
  let messageSender: MessageSender
  let recipientService: RecipientService

  beforeAll(async () => {
    agentConfig = new AgentConfig(initConfig)
    wallet = new IndyWallet(agentConfig)
    await wallet.init()
  })

  afterAll(async () => {
    await wallet.close()
    await wallet.delete()
  })

  beforeEach(() => {
    // Clear all instances and calls to constructor and all methods:
    MediationRepository.mockClear()
    mediationRepository = new MediationRepository()
    recipientService = new RecipientService(agentConfig, mediationRepository, messageSender, wallet)
  })

  describe('MediationRecord test', () => {
    it('validates mediation record class', () => {
      const record = new MediationRecord({
        state: MediationState.Init,
        role: MediationRole.Recipient,
        connectionId: 'fakeConnectionId',
        recipientKeys: ['fakeRecipientKey'],
        tags: {
          state: MediationState.Init,
          role: MediationRole.Recipient,
          connectionId: 'fakeConnectionId',
          default: 'false',
        },
      })
      assert(record.state, 'Expected MediationRecord to have an `state` property')
      expect(record.state).toBeDefined()
      assert(record.role, 'Expected MediationRecord to have an `role` property')
      expect(record.role).toBeDefined()
      assert(record.tags, 'Expected MediationRecord to have an `tags` property')
      expect(record.tags).toBeDefined()
      assert(record.tags.state, 'Expected MediationRecord to have an `tags.state` property')
      assert(record.tags.role, 'Expected MediationRecord to have an `tags.role` property')
      assert(record.tags.connectionId, 'Expected MediationRecord to have an `tags.connectionId` property')
      assert(record.connectionId, 'Expected MediationRecord to have an `connectionId` property')
      expect(record.connectionId).toBeDefined()
      assert(record.endpoint, 'Expected MediationRecord to have an `endpoint` property')
      assert(record.recipientKeys, 'Expected MediationRecord to have an `recipientKeys` property')
      expect(record.recipientKeys).toBeDefined()
      assert(record.routingKeys, 'Expected MediationRecord to have an `routingKeys` property')
      expect(record.routingKeys).toBeDefined()
    })
  })
  describe('Recipient service tests', () => {
    it('validate service class signiture', () => {
      const service = new RecipientService(agentConfig, mediationRepository, messageSender, wallet)
      assert(service.setDefaultMediator, 'Expected RecipientService to have a `setDefaultMediator` method')
      assert(service.getDefaultMediator, 'Expected RecipientService to have a `getDefaultMediator` method')
      assert(service.getDefaultMediatorId, 'Expected RecipientService to have a `getDefaultMediatorId` method')
      assert(service.getMediators, 'Expected RecipientService to have a `getMediators` method')
      assert(service.clearDefaultMediator, 'Expected RecipientService to have a `clearDefaultMediator` method')
      assert(service.findByConnectionId, 'Expected RecipientService to have a `findByConnectionId` method')
      assert(service.findById, 'Expected RecipientService to have a `findById` method')
      assert(service.processMediationDeny, 'Expected RecipientService to have a `processMediationDeny` method')
      assert(service.processMediationGrant, 'Expected RecipientService to have a `processMediationGrant` method')
      assert(
        service.processKeylistUpdateResults,
        'Expected RecipientService to have a `processKeylistUpdateResults` method'
      )
      assert(service.createKeylistQuery, 'Expected RecipientService to have a `createKeylistQuery` method')
      assert(service.createRequest, 'Expected RecipientService to have a `createRequest` method')
      //assert(service.createRecord, 'Expected RecipientService to have a `createRecord` method')
    })
    it('setDefaultMediator adds changes tags on mediation records', () => {
      throw 'not implemented'
    })
    it('getDefaultMediator returns mediation record with default tag set to "true"', () => {
      throw 'not implemented'
    })
    it('getDefaultMediatorId returns id of the mediation record with default tag set to "true"', () => {
      throw 'not implemented'
    })
    it('getMediators returns all mediation records', () => {
      throw 'not implemented'
    })
    it('clearDefaultMediator sets all mediation record tags to "false"', () => {
      throw 'not implemented'
    })
    it('findByConnectionId returns mediation record given a connectionId', () => {
      throw 'not implemented'
    })
    it('findById returns mediation record given mediationId', () => {
      throw 'not implemented'
    })
    it('processMediationDeny...', () => {
      throw 'not implemented'
    })
    it('processMediationGrant...', () => {
      throw 'not implemented'
    })
    it('processKeylistUpdateResults...', () => {
      throw 'not implemented'
    })
    it('createKeylistQuery...', () => {
      throw 'not implemented'
    })
    it('createRequest...', () => {
      throw 'not implemented'
    })
    it('createRecord...', () => {
      throw 'not implemented'
    })
  })
})
