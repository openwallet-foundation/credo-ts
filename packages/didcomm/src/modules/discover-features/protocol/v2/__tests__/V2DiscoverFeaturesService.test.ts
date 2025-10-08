import type {
  DidCommDiscoverFeaturesDisclosureReceivedEvent,
  DidCommDiscoverFeaturesQueryReceivedEvent,
} from '../../../DidCommDiscoverFeaturesEvents'
import type { DiscoverFeaturesProtocolMsgReturnType } from '../../../DidCommDiscoverFeaturesServiceOptions'

import { Subject } from 'rxjs'

import type { MockedClassConstructor } from '../../../../../../../../tests/types'
import { EventEmitter } from '../../../../../../../core/src/agent/EventEmitter'
import { ConsoleLogger } from '../../../../../../../core/src/logger'
import { agentDependencies, getAgentContext, getMockConnection } from '../../../../../../../core/tests/helpers'
import { DidCommFeatureRegistry } from '../../../../../DidCommFeatureRegistry'
import { DidCommMessageHandlerRegistry } from '../../../../../DidCommMessageHandlerRegistry'
import { DidCommGoalCode, DidCommInboundMessageContext, DidCommProtocol } from '../../../../../models'
import { DidCommDidExchangeState } from '../../../../connections'
import { DidCommDiscoverFeaturesEventTypes } from '../../../DidCommDiscoverFeaturesEvents'
import { DidCommDiscoverFeaturesModuleConfig } from '../../../DidCommDiscoverFeaturesModuleConfig'
import { DidCommDiscoverFeaturesV2Service } from '../DidCommDiscoverFeaturesV2Service'
import { DidCommFeaturesDisclosuresMessage, DidCommFeaturesQueriesMessage } from '../messages'

vi.mock('../../../../../DidCommMessageHandlerRegistry')
const MessageHandlerRegistryMock = DidCommMessageHandlerRegistry as MockedClassConstructor<
  typeof DidCommMessageHandlerRegistry
>
const eventEmitter = new EventEmitter(agentDependencies, new Subject())
const featureRegistry = new DidCommFeatureRegistry()
featureRegistry.register(new DidCommProtocol({ id: 'https://didcomm.org/connections/1.0' }))
featureRegistry.register(
  new DidCommProtocol({ id: 'https://didcomm.org/notification/1.0', roles: ['role-1', 'role-2'] })
)
featureRegistry.register(new DidCommProtocol({ id: 'https://didcomm.org/issue-credential/1.0' }))
featureRegistry.register(new DidCommGoalCode({ id: 'aries.vc.1' }))
featureRegistry.register(new DidCommGoalCode({ id: 'aries.vc.2' }))
featureRegistry.register(new DidCommGoalCode({ id: 'caries.vc.3' }))

vi.mock('../../../../../../../core/src/logger')
const LoggerMock = ConsoleLogger as MockedClassConstructor<typeof ConsoleLogger>

describe('V2DiscoverFeaturesService - auto accept queries', () => {
  const discoverFeaturesModuleConfig = new DidCommDiscoverFeaturesModuleConfig({ autoAcceptQueries: true })

  const discoverFeaturesService = new DidCommDiscoverFeaturesV2Service(
    featureRegistry,
    eventEmitter,
    new MessageHandlerRegistryMock(),
    new LoggerMock(),
    discoverFeaturesModuleConfig
  )
  describe('createDisclosure', () => {
    it('should return all items when query is *', async () => {
      const queryMessage = new DidCommFeaturesQueriesMessage({
        queries: [
          { featureType: DidCommProtocol.type, match: '*' },
          { featureType: DidCommGoalCode.type, match: '*' },
        ],
      })

      const { message } = await discoverFeaturesService.createDisclosure({
        disclosureQueries: queryMessage.queries,
        threadId: queryMessage.threadId,
      })

      expect(message.disclosures.map((p) => p.id)).toStrictEqual([
        'https://didcomm.org/connections/1.0',
        'https://didcomm.org/notification/1.0',
        'https://didcomm.org/issue-credential/1.0',
        'aries.vc.1',
        'aries.vc.2',
        'caries.vc.3',
      ])
    })

    it('should return only one protocol if the query specifies a specific protocol', async () => {
      const queryMessage = new DidCommFeaturesQueriesMessage({
        queries: [{ featureType: 'protocol', match: 'https://didcomm.org/connections/1.0' }],
      })

      const { message } = await discoverFeaturesService.createDisclosure({
        disclosureQueries: queryMessage.queries,
        threadId: queryMessage.threadId,
      })

      expect(message.disclosures).toEqual([{ type: 'protocol', id: 'https://didcomm.org/connections/1.0' }])
    })

    it('should respect a wild card at the end of the query', async () => {
      const queryMessage = new DidCommFeaturesQueriesMessage({
        queries: [
          { featureType: 'protocol', match: 'https://didcomm.org/connections/*' },
          { featureType: 'goal-code', match: 'aries*' },
        ],
      })

      const { message } = await discoverFeaturesService.createDisclosure({
        disclosureQueries: queryMessage.queries,
        threadId: queryMessage.threadId,
      })

      expect(message.disclosures.map((p) => p.id)).toStrictEqual([
        'https://didcomm.org/connections/1.0',
        'aries.vc.1',
        'aries.vc.2',
      ])
    })

    it('should send an empty array if no feature matches query', async () => {
      const queryMessage = new DidCommFeaturesQueriesMessage({
        queries: [{ featureType: 'anything', match: 'not-supported' }],
      })

      const { message } = await discoverFeaturesService.createDisclosure({
        disclosureQueries: queryMessage.queries,
        threadId: queryMessage.threadId,
      })

      expect(message.disclosures).toStrictEqual([])
    })

    it('should accept an empty queries object', async () => {
      const { message } = await discoverFeaturesService.createDisclosure({
        disclosureQueries: [],
        threadId: '1234',
      })

      expect(message.disclosures).toStrictEqual([])
    })

    it('should accept no thread Id', async () => {
      const { message } = await discoverFeaturesService.createDisclosure({
        disclosureQueries: [{ featureType: 'goal-code', match: 'caries*' }],
      })

      expect(message.disclosures).toEqual([
        {
          type: 'goal-code',
          id: 'caries.vc.3',
        },
      ])
      expect(message.threadId).toEqual(message.id)
    })
  })

  describe('createQuery', () => {
    it('should return a queries message with the query and comment', async () => {
      const { message } = await discoverFeaturesService.createQuery({
        queries: [{ featureType: 'protocol', match: '*' }],
      })

      expect(message.queries).toEqual([{ featureType: 'protocol', match: '*' }])
    })

    it('should accept multiple features', async () => {
      const { message } = await discoverFeaturesService.createQuery({
        queries: [
          { featureType: 'protocol', match: '1' },
          { featureType: 'anything', match: '2' },
        ],
      })

      expect(message.queries).toEqual([
        { featureType: 'protocol', match: '1' },
        { featureType: 'anything', match: '2' },
      ])
    })
  })

  describe('processQuery', () => {
    it('should emit event and create disclosure message', async () => {
      const eventListenerMock = vi.fn()
      eventEmitter.on<DidCommDiscoverFeaturesQueryReceivedEvent>(
        DidCommDiscoverFeaturesEventTypes.QueryReceived,
        eventListenerMock
      )

      const queryMessage = new DidCommFeaturesQueriesMessage({ queries: [{ featureType: 'protocol', match: '*' }] })

      const connection = getMockConnection({ state: DidCommDidExchangeState.Completed })
      const messageContext = new DidCommInboundMessageContext(queryMessage, {
        agentContext: getAgentContext(),
        connection,
      })
      const outboundMessage = await discoverFeaturesService.processQuery(messageContext)

      eventEmitter.off<DidCommDiscoverFeaturesQueryReceivedEvent>(
        DidCommDiscoverFeaturesEventTypes.QueryReceived,
        eventListenerMock
      )

      expect(eventListenerMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: DidCommDiscoverFeaturesEventTypes.QueryReceived,
          payload: expect.objectContaining({
            connection,
            protocolVersion: 'v2',
            queries: queryMessage.queries,
            threadId: queryMessage.threadId,
          }),
        })
      )
      expect(outboundMessage).toBeDefined()
      expect(
        (
          outboundMessage as DiscoverFeaturesProtocolMsgReturnType<DidCommFeaturesDisclosuresMessage>
        ).message.disclosures.map((p) => p.id)
      ).toStrictEqual([
        'https://didcomm.org/connections/1.0',
        'https://didcomm.org/notification/1.0',
        'https://didcomm.org/issue-credential/1.0',
      ])
    })
  })

  describe('processDisclosure', () => {
    it('should emit event', async () => {
      const eventListenerMock = vi.fn()
      eventEmitter.on<DidCommDiscoverFeaturesDisclosureReceivedEvent>(
        DidCommDiscoverFeaturesEventTypes.DisclosureReceived,
        eventListenerMock
      )

      const discloseMessage = new DidCommFeaturesDisclosuresMessage({
        features: [
          new DidCommProtocol({ id: 'prot1', roles: ['role1', 'role2'] }),
          new DidCommProtocol({ id: 'prot2' }),
        ],
        threadId: '1234',
      })

      const connection = getMockConnection({ state: DidCommDidExchangeState.Completed })
      const messageContext = new DidCommInboundMessageContext(discloseMessage, {
        agentContext: getAgentContext(),
        connection,
      })
      await discoverFeaturesService.processDisclosure(messageContext)

      eventEmitter.off<DidCommDiscoverFeaturesDisclosureReceivedEvent>(
        DidCommDiscoverFeaturesEventTypes.DisclosureReceived,
        eventListenerMock
      )

      expect(eventListenerMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: DidCommDiscoverFeaturesEventTypes.DisclosureReceived,
          payload: expect.objectContaining({
            connection,
            protocolVersion: 'v2',
            disclosures: [
              { type: 'protocol', id: 'prot1', roles: ['role1', 'role2'] },
              { type: 'protocol', id: 'prot2' },
            ],

            threadId: discloseMessage.threadId,
          }),
        })
      )
    })
  })
})

describe('V2DiscoverFeaturesService - auto accept disabled', () => {
  const discoverFeaturesModuleConfig = new DidCommDiscoverFeaturesModuleConfig({ autoAcceptQueries: false })

  const discoverFeaturesService = new DidCommDiscoverFeaturesV2Service(
    featureRegistry,
    eventEmitter,
    new MessageHandlerRegistryMock(),
    new LoggerMock(),
    discoverFeaturesModuleConfig
  )

  describe('processQuery', () => {
    it('should emit event and not send any message', async () => {
      const eventListenerMock = vi.fn()
      eventEmitter.on<DidCommDiscoverFeaturesQueryReceivedEvent>(
        DidCommDiscoverFeaturesEventTypes.QueryReceived,
        eventListenerMock
      )

      const queryMessage = new DidCommFeaturesQueriesMessage({ queries: [{ featureType: 'protocol', match: '*' }] })

      const connection = getMockConnection({ state: DidCommDidExchangeState.Completed })
      const messageContext = new DidCommInboundMessageContext(queryMessage, {
        agentContext: getAgentContext(),
        connection,
      })
      const outboundMessage = await discoverFeaturesService.processQuery(messageContext)

      eventEmitter.off<DidCommDiscoverFeaturesQueryReceivedEvent>(
        DidCommDiscoverFeaturesEventTypes.QueryReceived,
        eventListenerMock
      )

      expect(eventListenerMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: DidCommDiscoverFeaturesEventTypes.QueryReceived,
          payload: expect.objectContaining({
            connection,
            protocolVersion: 'v2',
            queries: queryMessage.queries,
            threadId: queryMessage.threadId,
          }),
        })
      )
      expect(outboundMessage).toBeUndefined()
    })
  })
})
