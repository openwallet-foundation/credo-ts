import { rightSplit } from '../string'

describe('string', () => {
  describe('rightSplit', () => {
    it('correctly splits a string starting from the right', () => {
      const messageType = 'https://didcomm.org/connections/1.0/invitation'

      expect(rightSplit(messageType, '/', 3)).toEqual(['https://didcomm.org', 'connections', '1.0', 'invitation'])
    })
  })
})
