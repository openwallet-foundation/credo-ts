import { ReplaySubject } from 'rxjs'
import { DidCommDiscoverFeaturesEventTypes, DidCommGoalCode } from '../../didcomm/src'
import {
  waitForDisclosureSubject,
  waitForQuerySubject,
} from '../../didcomm/src/modules/discover-features/__tests__/helpers'
import type {
  DidCommDiscoverFeaturesDisclosureReceivedEvent,
  DidCommDiscoverFeaturesQueryReceivedEvent,
} from '../../didcomm/src/modules/discover-features/DidCommDiscoverFeaturesEvents'
import { Agent } from '../src/agent/Agent'
import { getAgentOptions, makeConnection, waitForBasicMessage } from './helpers'
import { setupSubjectTransports } from './transport'

const faberAgent = new Agent(
  getAgentOptions(
    'Faber DIDComm v2 Modules',
    { endpoints: ['rxjs:faber-v2mod'], didcommVersions: ['v1', 'v2'] },
    undefined,
    undefined,
    { requireDidcomm: true }
  )
)

const aliceAgent = new Agent(
  getAgentOptions(
    'Alice DIDComm v2 Modules',
    { endpoints: ['rxjs:alice-v2mod'], didcommVersions: ['v1', 'v2'] },
    undefined,
    undefined,
    { requireDidcomm: true }
  )
)

describe('DIDComm v2 modules', () => {
  describe('Basic messages', () => {
    let faberConnection: Awaited<ReturnType<typeof makeConnection>>[0]
    let aliceConnection: Awaited<ReturnType<typeof makeConnection>>[1]

    beforeEach(async () => {
      setupSubjectTransports([faberAgent, aliceAgent])
      await faberAgent.initialize()
      await aliceAgent.initialize()
      ;[faberConnection, aliceConnection] = await makeConnection(faberAgent, aliceAgent)
    })

    afterEach(async () => {
      await faberAgent.shutdown()
      await aliceAgent.shutdown()
    })

    it('exchanges basic messages over DIDComm v2', async () => {
      const helloRecord = await aliceAgent.didcomm.basicMessages.sendMessage(aliceConnection.id, 'Hello over v2')
      expect(helloRecord.content).toBe('Hello over v2')

      const receivedHello = await waitForBasicMessage(faberAgent, {
        content: 'Hello over v2',
      })
      expect(receivedHello.content).toBe('Hello over v2')

      const replyRecord = await faberAgent.didcomm.basicMessages.sendMessage(faberConnection.id, 'How are you? (v2)')
      expect(replyRecord.content).toBe('How are you? (v2)')

      const receivedReply = await waitForBasicMessage(aliceAgent, {
        content: 'How are you? (v2)',
      })
      expect(receivedReply.content).toBe('How are you? (v2)')
    })

    it('sends basic message with parentThreadId over DIDComm v2', async () => {
      const helloRecord = await aliceAgent.didcomm.basicMessages.sendMessage(aliceConnection.id, 'Threaded hello')
      expect(helloRecord.content).toBe('Threaded hello')

      const helloMessage = await waitForBasicMessage(faberAgent, {
        content: 'Threaded hello',
      })

      const replyRecord = await faberAgent.didcomm.basicMessages.sendMessage(
        faberConnection.id,
        'Threaded reply',
        helloMessage.id
      )
      expect(replyRecord.content).toBe('Threaded reply')
      expect(replyRecord.parentThreadId).toBe(helloMessage.id)

      await waitForBasicMessage(aliceAgent, {
        content: 'Threaded reply',
      })
    })
  })

  describe('Discover features', () => {
    let faberConnection: Awaited<ReturnType<typeof makeConnection>>[0]
    let aliceConnection: Awaited<ReturnType<typeof makeConnection>>[1]

    beforeEach(async () => {
      setupSubjectTransports([faberAgent, aliceAgent])
      await faberAgent.initialize()
      await aliceAgent.initialize()

      ;[faberConnection, aliceConnection] = await makeConnection(faberAgent, aliceAgent)
    })

    afterEach(async () => {
      await faberAgent.shutdown()
      await aliceAgent.shutdown()
    })

    it('queries features over DIDComm v2', async () => {
      const faberReplay = new ReplaySubject<DidCommDiscoverFeaturesDisclosureReceivedEvent>()
      const aliceReplay = new ReplaySubject<DidCommDiscoverFeaturesQueryReceivedEvent>()

      faberAgent.events
        .observable<DidCommDiscoverFeaturesDisclosureReceivedEvent>(
          DidCommDiscoverFeaturesEventTypes.DisclosureReceived
        )
        .subscribe(faberReplay)
      aliceAgent.events
        .observable<DidCommDiscoverFeaturesQueryReceivedEvent>(DidCommDiscoverFeaturesEventTypes.QueryReceived)
        .subscribe(aliceReplay)

      await faberAgent.didcomm.discovery.queryFeatures({
        connectionId: faberConnection.id,
        protocolVersion: 'v2',
        queries: [{ featureType: 'protocol', match: 'https://didcomm.org/revocation_notification/*' }],
      })

      const query = await waitForQuerySubject(aliceReplay, { timeoutMs: 10000 })
      expect(query).toMatchObject({
        protocolVersion: 'v2',
        queries: [{ featureType: 'protocol', match: 'https://didcomm.org/revocation_notification/*' }],
      })

      const disclosure = await waitForDisclosureSubject(faberReplay, { timeoutMs: 10000 })
      expect(disclosure).toMatchObject({
        protocolVersion: 'v2',
        disclosures: expect.arrayContaining([
          expect.objectContaining({
            type: 'protocol',
            id: 'https://didcomm.org/revocation_notification/1.0',
          }),
          expect.objectContaining({
            type: 'protocol',
            id: 'https://didcomm.org/revocation_notification/2.0',
          }),
        ]),
      })
    })

    it('queries goal codes over DIDComm v2', async () => {
      const faberReplay = new ReplaySubject<DidCommDiscoverFeaturesQueryReceivedEvent>()
      const aliceReplay = new ReplaySubject<DidCommDiscoverFeaturesDisclosureReceivedEvent>()

      aliceAgent.events
        .observable<DidCommDiscoverFeaturesDisclosureReceivedEvent>(
          DidCommDiscoverFeaturesEventTypes.DisclosureReceived
        )
        .subscribe(aliceReplay)
      faberAgent.events
        .observable<DidCommDiscoverFeaturesQueryReceivedEvent>(DidCommDiscoverFeaturesEventTypes.QueryReceived)
        .subscribe(faberReplay)

      faberAgent.didcomm.features.register(new DidCommGoalCode({ id: 'v2.e2e.goal.test' }))

      await aliceAgent.didcomm.discovery.queryFeatures({
        connectionId: aliceConnection.id,
        protocolVersion: 'v2',
        queries: [{ featureType: 'goal-code', match: 'v2.e2e.*' }],
      })

      const query = await waitForQuerySubject(faberReplay, { timeoutMs: 10000 })
      expect(query).toMatchObject({
        protocolVersion: 'v2',
        queries: [{ featureType: 'goal-code', match: 'v2.e2e.*' }],
      })

      const disclosure = await waitForDisclosureSubject(aliceReplay, { timeoutMs: 10000 })
      expect(disclosure).toMatchObject({
        protocolVersion: 'v2',
        disclosures: expect.arrayContaining([
          expect.objectContaining({
            type: 'goal-code',
            id: 'v2.e2e.goal.test',
          }),
        ]),
      })
    })
  })
})
