import { NodeFileSystem } from '../src/NodeFileSystem'

describe('@aries-framework/file-system-node', () => {
  describe('NodeFileSystem', () => {
    const fileSystem = new NodeFileSystem()

    describe('exists()', () => {
      it('should return false if the pash does not exist', () => {
        return expect(fileSystem.exists('some-random-path')).resolves.toBe(false)
      })
    })
  })
})
