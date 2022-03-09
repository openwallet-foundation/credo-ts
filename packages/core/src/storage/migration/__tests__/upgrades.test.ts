import { supportedUpgrades } from '../upgrades'
import { upgradeV0_1ToV0_2 } from '../upgrades/0.1-0.2'

describe('supportedUpgrades', () => {
  // This test is intentional to be bumped explicitly when a new upgrade is added
  it('supports 1 upgrade(s)', () => {
    expect(supportedUpgrades.length).toBe(1)
  })

  it('supports an upgrade from 0.1 to 0.2', () => {
    const upgrade = supportedUpgrades[0]
    expect(upgrade.fromVersion).toBe('0.1')
    expect(upgrade.toVersion).toBe('0.2')
    expect(upgrade.doUpgrade).toBe(upgradeV0_1ToV0_2)
  })
})
