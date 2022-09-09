import type { BaseRecord } from '../../BaseRecord'

import { InMemoryStorageService } from '../../../../../../tests/InMemoryStorageService'
import { getBaseConfig } from '../../../../tests/helpers'
import { Agent } from '../../../agent/Agent'
import { InjectionSymbols } from '../../../constants'
import { DependencyManager } from '../../../plugins'
import { UpdateAssistant } from '../UpdateAssistant'

const { agentDependencies, config } = getBaseConfig('UpdateAssistant')

describe('UpdateAssistant', () => {
  let updateAssistant: UpdateAssistant
  let agent: Agent
  let storageService: InMemoryStorageService<BaseRecord>

  beforeEach(async () => {
    const dependencyManager = new DependencyManager()
    storageService = new InMemoryStorageService()
    dependencyManager.registerInstance(InjectionSymbols.StorageService, storageService)

    agent = new Agent(config, agentDependencies, dependencyManager)

    updateAssistant = new UpdateAssistant(agent, {
      v0_1ToV0_2: {
        mediationRoleUpdateStrategy: 'allMediator',
      },
    })

    await updateAssistant.initialize()
  })

  afterEach(async () => {
    await agent.shutdown()
    await agent.wallet.delete()
  })

  describe('upgrade()', () => {
    it('should not upgrade records when upgrading after a new wallet is created', async () => {
      const beforeStorage = JSON.stringify(storageService.records)
      await updateAssistant.update()

      expect(JSON.parse(beforeStorage)).toEqual(storageService.records)
    })
  })

  describe('isUpToDate()', () => {
    it('should return true when a new wallet is created', async () => {
      expect(await updateAssistant.isUpToDate()).toBe(true)
    })
  })

  describe('isUpToDate()', () => {
    it('should return true when a new wallet is created', async () => {
      expect(await updateAssistant.isUpToDate()).toBe(true)
    })

    it('should return true for a lower version than current storage', async () => {
      expect(await updateAssistant.isUpToDate('0.2')).toBe(true)
    })

    it('should return true for current agent storage version', async () => {
      expect(await updateAssistant.isUpToDate('0.3')).toBe(true)
    })
  })

  describe('UpdateAssistant.frameworkStorageVersion', () => {
    it('should return 0.2', async () => {
      expect(UpdateAssistant.frameworkStorageVersion).toBe('0.3')
    })
  })

  describe('getCurrentAgentStorageVersion()', () => {
    it('should return 0.3 when a new wallet is created', async () => {
      expect(await updateAssistant.getCurrentAgentStorageVersion()).toBe('0.3')
    })
  })
})
