import { mockProperty } from '../../../../../../tests/helpers'
import { Dispatcher } from '../../../../../agent/Dispatcher'
import { DiscoverFeaturesService } from '../DiscoverFeaturesService'
import { QueryMessage } from '../messages'

const supportedProtocols = [
  'https://didcomm.org/connections/1.0',
  'https://didcomm.org/notification/1.0',
  'https://didcomm.org/issue-credential/1.0',
]
jest.mock('../../../../../agent/Dispatcher')
const DispatcherMock = Dispatcher as jest.Mock<Dispatcher>
describe('DiscoverFeaturesService', () => {
  mockProperty(DispatcherMock.prototype, 'supportedProtocols', supportedProtocols)

  const discoverFeaturesService = new DiscoverFeaturesService(new DispatcherMock())
  describe('createDisclose', () => {
    it('should return all protocols when query is *', async () => {
      const queryMessage = new QueryMessage({
        query: '*',
      })

      const message = await discoverFeaturesService.createDisclose(queryMessage)

      expect(message.protocols.map((p) => p.protocolId)).toStrictEqual([
        'https://didcomm.org/connections/1.0',
        'https://didcomm.org/notification/1.0',
        'https://didcomm.org/issue-credential/1.0',
      ])
    })

    it('should return only one protocol if the query specifies a specific protocol', async () => {
      const queryMessage = new QueryMessage({
        query: 'https://didcomm.org/connections/1.0',
      })

      const message = await discoverFeaturesService.createDisclose(queryMessage)

      expect(message.protocols.map((p) => p.protocolId)).toStrictEqual(['https://didcomm.org/connections/1.0'])
    })

    it('should respect a wild card at the end of the query', async () => {
      const queryMessage = new QueryMessage({
        query: 'https://didcomm.org/connections/*',
      })

      const message = await discoverFeaturesService.createDisclose(queryMessage)

      expect(message.protocols.map((p) => p.protocolId)).toStrictEqual(['https://didcomm.org/connections/1.0'])
    })
  })

  describe('createQuery', () => {
    it('should return a query message with the query and comment', async () => {
      const message = await discoverFeaturesService.createQuery({
        query: '*',
        comment: 'Hello',
      })

      expect(message.query).toBe('*')
      expect(message.comment).toBe('Hello')
    })
  })
})
