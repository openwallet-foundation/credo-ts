import { TypedArrayEncoder } from '@credo-ts/core'
import nock, { cleanAll, enableNetConnect } from 'nock'
import path from 'path'

import { NodeFileSystem } from '../src/NodeFileSystem'

describe('@credo-ts/file-system-node', () => {
  describe('NodeFileSystem', () => {
    const fileSystem = new NodeFileSystem()

    afterAll(() => {
      cleanAll()
      enableNetConnect()
    })

    describe('exists()', () => {
      it('should return false if the pash does not exist', () => {
        return expect(fileSystem.exists('some-random-path')).resolves.toBe(false)
      })
    })

    describe('downloadToFile()', () => {
      test('should verify the hash', async () => {
        // Mock tails file
        nock('https://tails.prod.absa.africa')
          .get('/api/public/tails/4B1NxYuGxwYMe5BAyP9NXkUmbEkDATo4oGZCgjXQ3y1p')
          .replyWithFile(200, path.join(__dirname, '__fixtures__/tailsFile'))

        await fileSystem.downloadToFile(
          'https://tails.prod.absa.africa/api/public/tails/4B1NxYuGxwYMe5BAyP9NXkUmbEkDATo4oGZCgjXQ3y1p',
          `${fileSystem.dataPath}/tails/4B1NxYuGxwYMe5BAyP9NXkUmbEkDATo4oGZCgjXQ3y1p`,
          {
            verifyHash: {
              algorithm: 'sha256',
              hash: TypedArrayEncoder.fromBase58('4B1NxYuGxwYMe5BAyP9NXkUmbEkDATo4oGZCgjXQ3y1p'),
            },
          }
        )
      })
    })
  })
})
