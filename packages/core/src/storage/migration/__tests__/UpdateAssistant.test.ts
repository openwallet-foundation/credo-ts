import type { BaseRecord } from '../../BaseRecord'
import type { DependencyContainer } from 'tsyringe'

import { container as baseContainer } from 'tsyringe'

import { InMemoryStorageService } from '../../../../../../tests/InMemoryStorageService'
import { getBaseConfig } from '../../../../tests/helpers'
import { Agent } from '../../../agent/Agent'
import { InjectionSymbols } from '../../../constants'
import { UpdateAssistant } from '../UpdateAssistant'

const { agentDependencies, config } = getBaseConfig('UpdateAssistant')

describe('UpdateAssistant', () => {
  let updateAssistant: UpdateAssistant
  let agent: Agent
  let container: DependencyContainer
  let storageService: InMemoryStorageService<BaseRecord>

  beforeEach(async () => {
    container = baseContainer.createChildContainer()
    storageService = new InMemoryStorageService()
    container.registerInstance(InjectionSymbols.StorageService, storageService)

    agent = new Agent(config, agentDependencies, container)

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
  })

  describe('UpdateAssistant.frameworkStorageVersion', () => {
    it('should return 0.2', async () => {
      expect(UpdateAssistant.frameworkStorageVersion).toBe('0.2')
    })
  })

  describe('getCurrentAgentStorageVersion()', () => {
    it('should return 0.2 when a new wallet is created', async () => {
      expect(await updateAssistant.getCurrentAgentStorageVersion()).toBe('0.2')
    })
  })
})
