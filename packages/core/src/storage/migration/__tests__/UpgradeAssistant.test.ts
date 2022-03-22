import type { BaseRecord } from '../../BaseRecord'
import type { DependencyContainer } from 'tsyringe'

import { container as baseContainer } from 'tsyringe'

import { InMemoryStorageService } from '../../../../../../tests/InMemoryStorageService'
import { getBaseConfig } from '../../../../tests/helpers'
import { InjectionSymbols } from '../../../constants'
import { UpgradeAssistant } from '../UpgradeAssistant'

const { agentDependencies, config } = getBaseConfig('UpgradeAssistant')

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const walletConfig = config.walletConfig!

describe('UpgradeAssistant', () => {
  let upgradeAssistant: UpgradeAssistant
  let container: DependencyContainer
  let storageService: InMemoryStorageService<BaseRecord>

  beforeEach(async () => {
    container = baseContainer.createChildContainer()
    storageService = new InMemoryStorageService()
    container.registerInstance(InjectionSymbols.StorageService, storageService)

    upgradeAssistant = new UpgradeAssistant(
      {
        walletConfig,
        // logger: new TestLogger(LogLevel.trace),
        upgradeOptions: {
          v0_1ToV0_2: {
            mediationRoleUpdateStrategy: 'allMediator',
          },
        },
      },
      agentDependencies,
      container
    )

    await upgradeAssistant.initialize()
  })

  afterEach(async () => {
    await upgradeAssistant.shutdown({ deleteWallet: true })
  })

  describe('upgrade()', () => {
    it('should not upgrade records when upgrading after a new wallet is created', async () => {
      const beforeStorage = JSON.stringify(storageService.records)
      await upgradeAssistant.upgrade()

      expect(JSON.parse(beforeStorage)).toEqual(storageService.records)
    })
  })

  describe('isUpToDate()', () => {
    it('should return true when a new wallet is created', async () => {
      expect(await upgradeAssistant.isUpToDate()).toBe(true)
    })
  })

  describe('getNeededUpgrades()', () => {
    it('should return no upgrades when a new wallet is created', async () => {
      expect(await upgradeAssistant.getNeededUpgrades()).toEqual([])
    })
  })
})
