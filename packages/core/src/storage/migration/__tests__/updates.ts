import { supportedUpdates } from '../updates'

describe('supportedUpdates', () => {
  // This test is intentional to be bumped explicitly when a new upgrade is added
  it('supports 1 update(s)', () => {
    expect(supportedUpdates.length).toBe(0)
  })
})
