import { getAgentContext, mockProperty } from '../../../../../../tests/helpers'
import { Dispatcher } from '../../../../../agent/Dispatcher'
import { EventEmitter } from '../../../../../agent/EventEmitter'
import { ConsoleLogger } from '../../../../../logger/ConsoleLogger'
import { DiscoverFeaturesModuleConfig } from '../../../DiscoverFeaturesModuleConfig'
import { FeatureRegistry } from '../../../FeatureRegistry'
import { Protocol } from '../../../models'
import { V1DiscoverFeaturesService } from '../V1DiscoverFeaturesService'
import { V1QueryMessage } from '../messages'

const supportedProtocols = [
  'https://didcomm.org/connections/1.0',
  'https://didcomm.org/notification/1.0',
  'https://didcomm.org/issue-credential/1.0',
]
jest.mock('../../../../../agent/Dispatcher')
const DispatcherMock = Dispatcher as jest.Mock<Dispatcher>
jest.mock('../../../../../agent/EventEmitter')
const EventEmitterMock = EventEmitter as jest.Mock<EventEmitter>
const featureRegistry = new FeatureRegistry()
featureRegistry.register(new Protocol({ id: 'https://didcomm.org/connections/1.0' }))
featureRegistry.register(new Protocol({ id: 'https://didcomm.org/notification/1.0', roles: ['role-1', 'role-2'] }))
featureRegistry.register(new Protocol({ id: 'https://didcomm.org/issue-credential/1.0' }))

jest.mock('../../../../../logger/Logger')
const LoggerMock = ConsoleLogger as jest.Mock<ConsoleLogger>

const discoverFeaturesModuleConfig = new DiscoverFeaturesModuleConfig({ autoAcceptQueries: true })

describe('DiscoverFeaturesService', () => {
  mockProperty(DispatcherMock.prototype, 'supportedProtocols', supportedProtocols)

  const discoverFeaturesService = new V1DiscoverFeaturesService(
    featureRegistry,
    new EventEmitterMock(),
    new DispatcherMock(),
    new LoggerMock(),
    discoverFeaturesModuleConfig
  )
  describe('createDisclosure', () => {
    it('should return all protocols when query is *', async () => {
      const queryMessage = new V1QueryMessage({
        query: '*',
      })

      const { message } = await discoverFeaturesService.createDisclosure(getAgentContext(), {
        queries: [{ featureType: 'protocol', match: queryMessage.query }],
        threadId: queryMessage.threadId,
      })

      expect(message.protocols.map((p) => p.protocolId)).toStrictEqual([
        'https://didcomm.org/connections/1.0',
        'https://didcomm.org/notification/1.0',
        'https://didcomm.org/issue-credential/1.0',
      ])
    })

    it('should return only one protocol if the query specifies a specific protocol', async () => {
      const queryMessage = new V1QueryMessage({
        query: 'https://didcomm.org/connections/1.0',
      })

      const { message } = await discoverFeaturesService.createDisclosure(getAgentContext(), {
        queries: [{ featureType: 'protocol', match: queryMessage.query }],
        threadId: queryMessage.threadId,
      })

      expect(message.protocols.map((p) => p.protocolId)).toStrictEqual(['https://didcomm.org/connections/1.0'])
    })

    it('should respect a wild card at the end of the query', async () => {
      const queryMessage = new V1QueryMessage({
        query: 'https://didcomm.org/connections/*',
      })

      const { message } = await discoverFeaturesService.createDisclosure(getAgentContext(), {
        queries: [{ featureType: 'protocol', match: queryMessage.query }],
        threadId: queryMessage.threadId,
      })

      expect(message.protocols.map((p) => p.protocolId)).toStrictEqual(['https://didcomm.org/connections/1.0'])
    })
  })

  describe('createQuery', () => {
    it('should return a query message with the query and comment', async () => {
      const { message } = await discoverFeaturesService.createQuery(getAgentContext(), {
        queries: [{ featureType: 'protocol', match: '*' }],
        comment: 'Hello',
      })

      expect(message.query).toBe('*')
      expect(message.comment).toBe('Hello')
    })
  })
})
