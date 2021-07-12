import type { Wallet } from '../../../wallet/Wallet'

import { assert } from 'console'
import { Subject } from 'rxjs'

import { getBaseConfig } from '../../../__tests__/helpers'
import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { IndyWallet } from '../../../wallet/IndyWallet'
import { MediationRole, MediationState } from '../models'
import { MediationRecord } from '../repository'
import { MediationRepository } from '../repository/MediationRepository'
import { RecipientService } from '../services/RecipientService'

jest.mock('../services/RecipientService')
jest.mock('./../../../storage/Repository')
const MediationRepositoryMock = MediationRepository as jest.Mock<MediationRepository>

describe('Recipient', () => {
  const initConfig = getBaseConfig('RecipientService')

  let wallet: Wallet
  let agentConfig: AgentConfig
  let mediationRepository: MediationRepository
  let recipientService: RecipientService
  let eventEmitter: EventEmitter

  beforeAll(async () => {
    agentConfig = new AgentConfig(initConfig)
    wallet = new IndyWallet(agentConfig)
    await wallet.initialize(initConfig.walletConfig!, initConfig.walletCredentials!)
  })

  afterAll(async () => {
    await wallet.delete()
  })

  beforeEach(() => {
    mediationRepository = new MediationRepositoryMock()
    eventEmitter = new EventEmitter(new Subject<boolean>())
    recipientService = new RecipientService(mediationRepository, eventEmitter)
  })

  describe('MediationRecord test', () => {
    it('validates mediation record class', () => {
      const record = new MediationRecord({
        state: MediationState.Requested,
        role: MediationRole.Recipient,
        threadId: 'fakeThreadId',
        connectionId: 'fakeConnectionId',
        recipientKeys: ['fakeRecipientKey'],
        tags: {
          default: false,
        },
      })
      assert(record.state, 'Expected MediationRecord to have an `state` property')
      expect(record.state).toBeDefined()
      assert(record.role, 'Expected MediationRecord to have an `role` property')
      expect(record.role).toBeDefined()
      assert(record.getTags(), 'Expected MediationRecord to have an `tags` property')
      expect(record.getTags()).toBeDefined()
      assert(record.getTags().state, 'Expected MediationRecord to have an `tags.state` property')
      assert(record.getTags().role, 'Expected MediationRecord to have an `tags.role` property')
      assert(record.getTags().connectionId, 'Expected MediationRecord to have an `tags.connectionId` property')
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
      assert(recipientService.setDefaultMediator, 'Expected RecipientService to have a `setDefaultMediator` method')
      assert(recipientService.findDefaultMediator, 'Expected RecipientService to have a `getDefaultMediator` method')
      assert(recipientService.getMediators, 'Expected RecipientService to have a `getMediators` method')
      assert(recipientService.clearDefaultMediator, 'Expected RecipientService to have a `clearDefaultMediator` method')
      assert(recipientService.findByConnectionId, 'Expected RecipientService to have a `findByConnectionId` method')
      assert(recipientService.processMediationDeny, 'Expected RecipientService to have a `processMediationDeny` method')
      assert(
        recipientService.processMediationGrant,
        'Expected RecipientService to have a `processMediationGrant` method'
      )
      assert(
        recipientService.processKeylistUpdateResults,
        'Expected RecipientService to have a `processKeylistUpdateResults` method'
      )
      assert(recipientService.createRequest, 'Expected RecipientService to have a `createRequest` method')
      //assert(service.createRecord, 'Expected RecipientService to have a `createRecord` method')
    })
    it('setDefaultMediator adds changes tags on mediation records', () => {
      expect(true) //throw 'not implemented'
    })
    it('getDefaultMediator returns mediation record with default tag set to "true"', () => {
      expect(true) //throw 'not implemented'
    })
    it('getDefaultMediatorId returns id of the mediation record with default tag set to "true"', () => {
      expect(true) //throw 'not implemented'
    })
    it('getMediators returns all mediation records', () => {
      expect(true) //throw 'not implemented'
    })
    it('clearDefaultMediator sets all mediation record tags to "false"', () => {
      expect(true) //throw 'not implemented'
    })
    it('findByConnectionId returns mediation record given a connectionId', () => {
      expect(true) //throw 'not implemented'
    })
    it('findById returns mediation record given mediationId', () => {
      expect(true) //throw 'not implemented'
    })
    it('processMediationDeny...', () => {
      expect(true) //throw 'not implemented'
    })
    it('processMediationGrant...', () => {
      expect(true) //throw 'not implemented'
    })
    it('processKeylistUpdateResults...', () => {
      expect(true) //throw 'not implemented'
    })
    it('createKeylistQuery...', () => {
      expect(true) //throw 'not implemented'
    })
    it('createRequest...', () => {
      expect(true) //throw 'not implemented'
    })
    it('createRecord...', () => {
      expect(true) //throw 'not implemented'
    })
  })
})
