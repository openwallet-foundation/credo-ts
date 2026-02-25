import { Subject } from 'rxjs'
import type { MockedClassConstructor } from '../../../../../../../../tests/types'
import { EventEmitter } from '../../../../../../../core/src/agent/EventEmitter'
import { ConsoleLogger } from '../../../../../../../core/src/logger'
import { agentDependencies, getAgentContext, getMockConnection } from '../../../../../../../core/tests/helpers'
import { DidCommFeatureRegistry } from '../../../../../DidCommFeatureRegistry'
import { DidCommInboundMessageContext, DidCommProtocol } from '../../../../../models'
import { DidCommDidExchangeState } from '../../../../connections'
import type {
  DidCommDiscoverFeaturesDisclosureReceivedEvent,
  DidCommDiscoverFeaturesQueryReceivedEvent,
} from '../../../DidCommDiscoverFeaturesEvents'
import { DidCommDiscoverFeaturesEventTypes } from '../../../DidCommDiscoverFeaturesEvents'
import { DidCommDiscoverFeaturesModuleConfig } from '../../../DidCommDiscoverFeaturesModuleConfig'
import type { DiscoverFeaturesProtocolMsgReturnType } from '../../../DidCommDiscoverFeaturesServiceOptions'
import { DidCommDiscoverFeaturesV1Service } from '../DidCommDiscoverFeaturesV1Service'
import { DidCommFeaturesDiscloseMessage, DidCommFeaturesQueryMessage } from '../messages'

const eventEmitter = new EventEmitter(agentDependencies, new Subject())
const featureRegistry = new DidCommFeatureRegistry()
featureRegistry.register(new DidCommProtocol({ id: 'https://didcomm.org/connections/1.0' }))
featureRegistry.register(
  new DidCommProtocol({ id: 'https://didcomm.org/notification/1.0', roles: ['role-1', 'role-2'] })
)
featureRegistry.register(new DidCommProtocol({ id: 'https://didcomm.org/issue-credential/1.0' }))

vi.mock('../../../../../../../core/src/logger')
const LoggerMock = ConsoleLogger as MockedClassConstructor<typeof ConsoleLogger>

describe('V1DiscoverFeaturesService - auto accept queries', () => {
  const discoverFeaturesModuleConfig = new DidCommDiscoverFeaturesModuleConfig({ autoAcceptQueries: true })

  const discoverFeaturesService = new DidCommDiscoverFeaturesV1Service(
    featureRegistry,
    eventEmitter,
    new LoggerMock(),
    discoverFeaturesModuleConfig
  )
  describe('createDisclosure', () => {
    it('should return all protocols when query is *', async () => {
      const queryMessage = new DidCommFeaturesQueryMessage({
        query: '*',
      })

      const { message } = await discoverFeaturesService.createDisclosure({
        disclosureQueries: [{ featureType: 'protocol', match: queryMessage.query }],
        threadId: queryMessage.threadId,
      })

      expect(message.protocols.map((p) => p.protocolId)).toStrictEqual([
        'https://didcomm.org/connections/1.0',
        'https://didcomm.org/notification/1.0',
        'https://didcomm.org/issue-credential/1.0',
      ])
    })

    it('should return only one protocol if the query specifies a specific protocol', async () => {
      const queryMessage = new DidCommFeaturesQueryMessage({
        query: 'https://didcomm.org/connections/1.0',
      })

      const { message } = await discoverFeaturesService.createDisclosure({
        disclosureQueries: [{ featureType: 'protocol', match: queryMessage.query }],
        threadId: queryMessage.threadId,
      })

      expect(message.protocols.map((p) => p.protocolId)).toStrictEqual(['https://didcomm.org/connections/1.0'])
    })

    it('should respect a wild card at the end of the query', async () => {
      const queryMessage = new DidCommFeaturesQueryMessage({
        query: 'https://didcomm.org/connections/*',
      })

      const { message } = await discoverFeaturesService.createDisclosure({
        disclosureQueries: [{ featureType: 'protocol', match: queryMessage.query }],
        threadId: queryMessage.threadId,
      })

      expect(message.protocols.map((p) => p.protocolId)).toStrictEqual(['https://didcomm.org/connections/1.0'])
    })

    it('should send an empty array if no feature matches query', async () => {
      const queryMessage = new DidCommFeaturesQueryMessage({
        query: 'not-supported',
      })

      const { message } = await discoverFeaturesService.createDisclosure({
        disclosureQueries: [{ featureType: 'protocol', match: queryMessage.query }],
        threadId: queryMessage.threadId,
      })

      expect(message.protocols.map((p) => p.protocolId)).toStrictEqual([])
    })

    it('should throw error if features other than protocols are disclosed', async () => {
      await expect(
        discoverFeaturesService.createDisclosure({
          disclosureQueries: [
            { featureType: 'protocol', match: '1' },
            { featureType: 'goal-code', match: '2' },
          ],
          threadId: '1234',
        })
      ).rejects.toThrow('Discover Features V1 only supports protocols')
    })

    it('should throw error if no thread id is provided', async () => {
      await expect(
        discoverFeaturesService.createDisclosure({
          disclosureQueries: [{ featureType: 'protocol', match: '1' }],
        })
      ).rejects.toThrow('Thread Id is required for Discover Features V1 disclosure')
    })
  })

  describe('createQuery', () => {
    it('should return a query message with the query and comment', async () => {
      const { message } = await discoverFeaturesService.createQuery({
        queries: [{ featureType: 'protocol', match: '*' }],
        comment: 'Hello',
      })

      expect(message.query).toBe('*')
      expect(message.comment).toBe('Hello')
    })

    it('should throw error if multiple features are queried', async () => {
      await expect(
        discoverFeaturesService.createQuery({
          queries: [
            { featureType: 'protocol', match: '1' },
            { featureType: 'protocol', match: '2' },
          ],
        })
      ).rejects.toThrow('Discover Features V1 only supports a single query')
    })

    it('should throw error if a feature other than protocol is queried', async () => {
      await expect(
        discoverFeaturesService.createQuery({
          queries: [{ featureType: 'goal-code', match: '1' }],
        })
      ).rejects.toThrow('Discover Features V1 only supports querying for protocol support')
    })
  })

  describe('processQuery', () => {
    it('should emit event and create disclosure message', async () => {
      const eventListenerMock = vi.fn()
      eventEmitter.on<DidCommDiscoverFeaturesQueryReceivedEvent>(
        DidCommDiscoverFeaturesEventTypes.QueryReceived,
        eventListenerMock
      )

      const queryMessage = new DidCommFeaturesQueryMessage({ query: '*' })

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
            protocolVersion: 'v1',
            queries: [{ featureType: 'protocol', match: queryMessage.query }],
            threadId: queryMessage.threadId,
          }),
        })
      )
      expect(outboundMessage).toBeDefined()
      expect(
        (
          outboundMessage as DiscoverFeaturesProtocolMsgReturnType<DidCommFeaturesDiscloseMessage>
        ).message.protocols.map((p) => p.protocolId)
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

      const discloseMessage = new DidCommFeaturesDiscloseMessage({
        protocols: [{ protocolId: 'prot1', roles: ['role1', 'role2'] }, { protocolId: 'prot2' }],
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
            protocolVersion: 'v1',
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

describe('V1DiscoverFeaturesService - auto accept disabled', () => {
  const discoverFeaturesModuleConfig = new DidCommDiscoverFeaturesModuleConfig({ autoAcceptQueries: false })

  const discoverFeaturesService = new DidCommDiscoverFeaturesV1Service(
    featureRegistry,
    eventEmitter,
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

      const queryMessage = new DidCommFeaturesQueryMessage({ query: '*' })

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
            protocolVersion: 'v1',
            queries: [{ featureType: 'protocol', match: queryMessage.query }],
            threadId: queryMessage.threadId,
          }),
        })
      )
      expect(outboundMessage).toBeUndefined()
    })
  })
})
