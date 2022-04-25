import { supportedUpdates } from '../updates'
import { updateV0_1ToV0_2 } from '../updates/0.1-0.2'

describe('supportedUpdates', () => {
  // This test is intentional to be bumped explicitly when a new upgrade is added
  it('supports 1 update(s)', () => {
    expect(supportedUpdates.length).toBe(1)
  })

  it('supports an update from 0.1 to 0.2', () => {
    const upgrade = supportedUpdates[0]
    expect(upgrade.fromVersion).toBe('0.1')
    expect(upgrade.toVersion).toBe('0.2')
    expect(upgrade.doUpdate).toBe(updateV0_1ToV0_2)
  })
})
