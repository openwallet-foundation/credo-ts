import { Dispatcher } from '../../../../../agent/Dispatcher'
import { FeatureRegistry } from '../../../FeatureRegistry'
import { GoalCode } from '../../../models/GoalCode'
import { GovernanceFramework } from '../../../models/GovernanceFramework'
import { Protocol } from '../../../models/Protocol'
import { V2DiscoverFeaturesService } from '../V2DiscoverFeaturesService'
import { V2QueriesMessage } from '../messages'

jest.mock('../../../../../agent/Dispatcher')
const DispatcherMock = Dispatcher as jest.Mock<Dispatcher>

const featureRegistry = new FeatureRegistry()
featureRegistry.register(new Protocol({ id: 'https://didcomm.org/connections/1.0' }))
featureRegistry.register(new Protocol({ id: 'https://didcomm.org/notification/1.0', roles: ['role-1', 'role-2'] }))
featureRegistry.register(new Protocol({ id: 'https://didcomm.org/issue-credential/1.0' }))
featureRegistry.register(new GoalCode({ id: 'aries.gc1' }))
featureRegistry.register(new GoalCode({ id: 'aries.gc2' }))
featureRegistry.register(new GovernanceFramework({ id: 'gov-1' }))
featureRegistry.register(new GovernanceFramework({ id: 'gov-2' }))
describe('DiscoverFeaturesService', () => {
  const discoverFeaturesService = new V2DiscoverFeaturesService(new DispatcherMock(), featureRegistry)
  describe('processQueries', () => {
    it('should return all protocols when query is *', async () => {
      const queryMessage = new V2QueriesMessage({
        queries: [{ featureType: 'protocol', match: '*' }],
      })

      const message = await discoverFeaturesService.processQueries(queryMessage)

      expect(message.disclosures.map((p) => p.id)).toStrictEqual([
        'https://didcomm.org/connections/1.0',
        'https://didcomm.org/notification/1.0',
        'https://didcomm.org/issue-credential/1.0',
      ])
    })

    it('should return only one protocol if the query specifies a specific protocol', async () => {
      const queryMessage = new V2QueriesMessage({
        queries: [{ featureType: 'protocol', match: 'https://didcomm.org/connections/1.0' }],
      })

      const message = await discoverFeaturesService.processQueries(queryMessage)

      expect(message.disclosures.length).toEqual(1)
      expect(message.disclosures.map((p) => p.id)).toStrictEqual(['https://didcomm.org/connections/1.0'])
    })

    it('should respect a wild card at the end of the query', async () => {
      const queryMessage = new V2QueriesMessage({
        queries: [{ featureType: 'protocol', match: 'https://didcomm.org/connections/*' }],
      })

      const message = await discoverFeaturesService.processQueries(queryMessage)

      expect(message.disclosures.map((p) => p.id)).toStrictEqual(['https://didcomm.org/connections/1.0'])
    })

    it('should create properly multiple feature types', async () => {
      const queryMessage = new V2QueriesMessage({
        queries: [
          { featureType: 'protocol', match: 'https://didcomm.org/notification/*' },
          { featureType: 'goal-code', match: '*' },
          { featureType: 'gov-fw', match: 'gov-2' },
        ],
      })

      const message = await discoverFeaturesService.processQueries(queryMessage)

      expect(message.disclosures.map((p) => p.id)).toStrictEqual([
        'https://didcomm.org/notification/1.0',
        'aries.gc1',
        'aries.gc2',
        'gov-2',
      ])
    })
  })

  describe('createQueries', () => {
    it('should return a queries message with the queries', async () => {
      const message = await discoverFeaturesService.createQueries({
        queries: [{ featureType: 'protocol', match: '*' }],
      })

      expect(message.queries).toEqual([{ featureType: 'protocol', match: '*' }])
    })
  })
})
