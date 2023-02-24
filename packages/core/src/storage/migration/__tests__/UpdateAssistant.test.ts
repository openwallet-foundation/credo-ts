import type { BaseRecord } from '../../BaseRecord'

import { InMemoryStorageService } from '../../../../../../tests/InMemoryStorageService'
import { IndySdkWallet } from '../../../../../indy-sdk/src'
import { IndySdkSymbol } from '../../../../../indy-sdk/src/types'
import { indySdk } from '../../../../../indy-sdk/tests/setupIndySdkModule'
import { getAgentOptions } from '../../../../tests/helpers'
import { Agent } from '../../../agent/Agent'
import { InjectionSymbols } from '../../../constants'
import { DependencyManager } from '../../../plugins'
import { UpdateAssistant } from '../UpdateAssistant'
import { CURRENT_FRAMEWORK_STORAGE_VERSION } from '../updates'

const agentOptions = getAgentOptions('UpdateAssistant', {})

describe('UpdateAssistant', () => {
  let updateAssistant: UpdateAssistant
  let agent: Agent
  let storageService: InMemoryStorageService<BaseRecord>

  beforeEach(async () => {
    const dependencyManager = new DependencyManager()
    storageService = new InMemoryStorageService()
    // If we register the IndySdkModule it will register the storage service, but we use in memory storage here
    dependencyManager.registerContextScoped(InjectionSymbols.Wallet, IndySdkWallet)
    dependencyManager.registerInstance(IndySdkSymbol, indySdk)
    dependencyManager.registerInstance(InjectionSymbols.StorageService, storageService)

    agent = new Agent(agentOptions, dependencyManager)

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
