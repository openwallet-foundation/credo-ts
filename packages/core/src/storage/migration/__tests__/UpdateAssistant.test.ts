import type { InMemoryStorageService } from '../../../../../../tests/InMemoryStorageService'
import type { BaseRecord } from '../../BaseRecord'

import { getAgentOptions } from '../../../../tests/helpers'
import { Agent } from '../../../agent/Agent'
import { InjectionSymbols } from '../../../constants'
import { UpdateAssistant } from '../UpdateAssistant'
import { CURRENT_FRAMEWORK_STORAGE_VERSION } from '../updates'

const agentOptions = getAgentOptions('UpdateAssistant', {})

describe('UpdateAssistant', () => {
  let updateAssistant: UpdateAssistant
  let agent: Agent
  let storageService: InMemoryStorageService<BaseRecord>

  beforeEach(async () => {
    agent = new Agent(agentOptions)

    updateAssistant = new UpdateAssistant(agent, {
      v0_1ToV0_2: {
        mediationRoleUpdateStrategy: 'allMediator',
      },
    })

    storageService = agent.dependencyManager.resolve(InjectionSymbols.StorageService)

    await updateAssistant.initialize()
  })

  afterEach(async () => {
    await agent.shutdown()
  })

  describe('upgrade()', () => {
    it('should not upgrade records when upgrading after a new wallet is created', async () => {
      // Make sure it's initialized
      storageService.createRecordsForContext(agent.context)

      const beforeStorage = JSON.stringify(storageService.contextCorrelationIdToRecords)
      await updateAssistant.update()

      // We parse and stringify so the dates are equal (both string)
      expect(JSON.parse(beforeStorage)).toEqual(
        JSON.parse(JSON.stringify(storageService.contextCorrelationIdToRecords))
      )
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

    it('should return false for a higher version than current storage', async () => {
      // @ts-expect-error isUpToDate only allows existing versions to be passed, 100.100 is not a valid version (yet)
      expect(await updateAssistant.isUpToDate('100.100')).toBe(false)
    })
  })

  describe('UpdateAssistant.frameworkStorageVersion', () => {
    it(`should return ${CURRENT_FRAMEWORK_STORAGE_VERSION}`, async () => {
      expect(UpdateAssistant.frameworkStorageVersion).toBe(CURRENT_FRAMEWORK_STORAGE_VERSION)
    })
  })

  describe('getCurrentAgentStorageVersion()', () => {
    it(`should return ${CURRENT_FRAMEWORK_STORAGE_VERSION} when a new wallet is created`, async () => {
      expect(await updateAssistant.getCurrentAgentStorageVersion()).toBe(CURRENT_FRAMEWORK_STORAGE_VERSION)
    })
  })
})
