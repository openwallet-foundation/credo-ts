import { getAgentContext, getMockConnection, mockProperty } from '../../../../../../tests/helpers'
import { Dispatcher } from '../../../../../agent/Dispatcher'
import { EventEmitter } from '../../../../../agent/EventEmitter'
import { ConsoleLogger } from '../../../../../logger/ConsoleLogger'
import { DiscoverFeaturesModuleConfig } from '../../../DiscoverFeaturesModuleConfig'
import { FeatureRegistry } from '../../../FeatureRegistry'
import { GoalCode } from '../../../models/GoalCode'
import { GovernanceFramework } from '../../../models/GovernanceFramework'
import { Protocol } from '../../../models/Protocol'
import { V2DiscoverFeaturesService } from '../V2DiscoverFeaturesService'
import { V2DisclosuresMessage, V2QueriesMessage } from '../messages'

jest.mock('../../../../../agent/Dispatcher')
const DispatcherMock = Dispatcher as jest.Mock<Dispatcher>

jest.mock('../../../../../agent/EventEmitter')
const EventEmitterMock = EventEmitter as jest.Mock<EventEmitter>
jest.mock('../../../../../logger/Logger')
const LoggerMock = ConsoleLogger as jest.Mock<ConsoleLogger>
const discoverFeaturesModuleConfig = new DiscoverFeaturesModuleConfig({ autoAcceptQueries: true })

const featureRegistry = new FeatureRegistry()
featureRegistry.register(new Protocol({ id: 'https://didcomm.org/connections/1.0' }))
featureRegistry.register(new Protocol({ id: 'https://didcomm.org/notification/1.0', roles: ['role-1', 'role-2'] }))
featureRegistry.register(new Protocol({ id: 'https://didcomm.org/issue-credential/1.0' }))
featureRegistry.register(new GoalCode({ id: 'aries.gc1' }))
featureRegistry.register(new GoalCode({ id: 'aries.gc2' }))
featureRegistry.register(new GovernanceFramework({ id: 'gov-1' }))
featureRegistry.register(new GovernanceFramework({ id: 'gov-2' }))

describe('DiscoverFeaturesService', () => {
  const discoverFeaturesService = new V2DiscoverFeaturesService(
    featureRegistry,
    new EventEmitterMock(),
    new DispatcherMock(),
    new LoggerMock(),
    discoverFeaturesModuleConfig
  )

  describe('processQueries', () => {
    it('should return all protocols when query is *', async () => {
      const queryMessage = new V2QueriesMessage({
        queries: [{ featureType: 'protocol', match: '*' }],
      })

      const response = await discoverFeaturesService.processQuery({
        agentContext: getAgentContext(),
        message: queryMessage,
        assertReadyConnection: () => getMockConnection(),
        toJSON: function (): {
          message: V2QueriesMessage
          recipientKey: string | undefined
          senderKey: string | undefined
          sessionId: string | undefined
          agentContext: { contextCorrelationId: string }
        } {
          throw new Error('Function not implemented.')
        },
      })
      if (response) {
        expect(response.message.disclosures.map((p) => p.id)).toStrictEqual([
          'https://didcomm.org/connections/1.0',
          'https://didcomm.org/notification/1.0',
          'https://didcomm.org/issue-credential/1.0',
        ])
      }
    })

    it('should return only one protocol if the query specifies a specific protocol', async () => {
      const queryMessage = new V2QueriesMessage({
        queries: [{ featureType: 'protocol', match: 'https://didcomm.org/connections/1.0' }],
      })

      const response = await discoverFeaturesService.processQuery({
        agentContext: getAgentContext(),
        message: queryMessage,
        assertReadyConnection: () => getMockConnection(),
        toJSON: function (): {
          message: V2QueriesMessage
          recipientKey: string | undefined
          senderKey: string | undefined
          sessionId: string | undefined
          agentContext: { contextCorrelationId: string }
        } {
          throw new Error('Function not implemented.')
        },
      })
      if (response) {
        const message = response.message
        expect(message).toBeInstanceOf(V2DisclosuresMessage)
        expect(message.disclosures.length).toEqual(1)
        expect(message.disclosures.map((p) => p.id)).toStrictEqual(['https://didcomm.org/connections/1.0'])
      }
    })

    it('should respect a wild card at the end of the query', async () => {
      const queryMessage = new V2QueriesMessage({
        queries: [{ featureType: 'protocol', match: 'https://didcomm.org/connections/*' }],
      })

      const response = await discoverFeaturesService.processQuery({
        agentContext: getAgentContext(),
        message: queryMessage,
        assertReadyConnection: () => getMockConnection(),
        toJSON: function (): {
          message: V2QueriesMessage
          recipientKey: string | undefined
          senderKey: string | undefined
          sessionId: string | undefined
          agentContext: { contextCorrelationId: string }
        } {
          throw new Error('Function not implemented.')
        },
      })
      expect(response).toBeDefined()
      if (response) {
        expect(response.message.disclosures.map((p) => p.id)).toStrictEqual(['https://didcomm.org/connections/1.0'])
      }
    })

    it('should create properly multiple feature types', async () => {
      const queryMessage = new V2QueriesMessage({
        queries: [
          { featureType: 'protocol', match: 'https://didcomm.org/notification/*' },
          { featureType: 'goal-code', match: '*' },
          { featureType: 'gov-fw', match: 'gov-2' },
        ],
      })

      const response = await discoverFeaturesService.processQuery({
        agentContext: getAgentContext(),
        message: queryMessage,
        assertReadyConnection: () => getMockConnection(),
        toJSON: function (): {
          message: V2QueriesMessage
          recipientKey: string | undefined
          senderKey: string | undefined
          sessionId: string | undefined
          agentContext: { contextCorrelationId: string }
        } {
          throw new Error('Function not implemented.')
        },
      })
      expect(response).toBeDefined()
      if (response) {
        expect(response.message.disclosures.map((p) => p.id)).toStrictEqual([
          'https://didcomm.org/notification/1.0',
          'aries.gc1',
          'aries.gc2',
          'gov-2',
        ])
      }
    })
  })

  describe('createQueries', () => {
    it('should return a queries message with the queries', async () => {
      const { message } = await discoverFeaturesService.createQuery(getAgentContext(), {
        queries: [{ featureType: 'protocol', match: '*' }],
      })

      expect(message.queries).toEqual([{ featureType: 'protocol', match: '*' }])
    })
  })
})
