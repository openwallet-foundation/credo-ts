import { getBaseConfig } from '../../../../tests/helpers'
import { UpgradeAssistant } from '../UpgradeAssistant'

const { agentDependencies, config } = getBaseConfig('UpgradeAssistant')

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const walletConfig = config.walletConfig!

describe('UpgradeAssistant', () => {
  let upgradeAssistant: UpgradeAssistant

  beforeEach(async () => {
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
      agentDependencies
    )

    await upgradeAssistant.initialize()
  })

  afterEach(async () => {
    await upgradeAssistant.shutdown()
  })

  describe('upgrade()', () => {
    it('should return true when a new wallet is created', async () => {
      expect(await upgradeAssistant.isUpToDate()).toBe(true)
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
