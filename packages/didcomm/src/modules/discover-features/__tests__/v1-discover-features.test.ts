import { ReplaySubject } from 'rxjs'
import { Agent } from '../../../../../core/src/agent/Agent'
import { setupSubjectTransports } from '../../../../../core/tests'
import { getAgentOptions, makeConnection } from '../../../../../core/tests/helpers'
import type { DidCommConnectionRecord } from '../../connections'
import type {
  DidCommDiscoverFeaturesDisclosureReceivedEvent,
  DidCommDiscoverFeaturesQueryReceivedEvent,
} from '../DidCommDiscoverFeaturesEvents'
import { DidCommDiscoverFeaturesEventTypes } from '../DidCommDiscoverFeaturesEvents'

import { waitForDisclosureSubject, waitForQuerySubject } from './helpers'

const faberAgentOptions = getAgentOptions(
  'Faber Discover Features V1 E2E',
  {
    endpoints: ['rxjs:faber'],
  },
  undefined,
  undefined,
  { requireDidcomm: true }
)

const aliceAgentOptions = getAgentOptions(
  'Alice Discover Features V1 E2E',
  {
    endpoints: ['rxjs:alice'],
  },
  undefined,
  undefined,
  { requireDidcomm: true }
)

describe('v1 discover features', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let faberConnection: DidCommConnectionRecord

  beforeAll(async () => {
    faberAgent = new Agent(faberAgentOptions)
    aliceAgent = new Agent(aliceAgentOptions)

    setupSubjectTransports([faberAgent, aliceAgent])

    await faberAgent.initialize()
    await aliceAgent.initialize()
    ;[faberConnection] = await makeConnection(faberAgent, aliceAgent)
  })

  afterAll(async () => {
    await faberAgent.shutdown()
    await aliceAgent.shutdown()
  })

  test('Faber asks Alice for revocation notification protocol support', async () => {
    const faberReplay = new ReplaySubject<DidCommDiscoverFeaturesDisclosureReceivedEvent>()
    const aliceReplay = new ReplaySubject<DidCommDiscoverFeaturesQueryReceivedEvent>()

    faberAgent.events
      .observable<DidCommDiscoverFeaturesDisclosureReceivedEvent>(DidCommDiscoverFeaturesEventTypes.DisclosureReceived)
      .subscribe(faberReplay)
    aliceAgent.events
      .observable<DidCommDiscoverFeaturesQueryReceivedEvent>(DidCommDiscoverFeaturesEventTypes.QueryReceived)
      .subscribe(aliceReplay)

    await faberAgent.didcomm.discovery.queryFeatures({
      connectionId: faberConnection.id,
      protocolVersion: 'v1',
      queries: [{ featureType: 'protocol', match: 'https://didcomm.org/revocation_notification/*' }],
    })

    const query = await waitForQuerySubject(aliceReplay, { timeoutMs: 10000 })

    expect(query).toMatchObject({
      protocolVersion: 'v1',
      queries: [{ featureType: 'protocol', match: 'https://didcomm.org/revocation_notification/*' }],
    })

    const disclosure = await waitForDisclosureSubject(faberReplay, { timeoutMs: 10000 })

    expect(disclosure).toMatchObject({
      protocolVersion: 'v1',
      disclosures: [
        { type: 'protocol', id: 'https://didcomm.org/revocation_notification/1.0', roles: ['holder'] },
        { type: 'protocol', id: 'https://didcomm.org/revocation_notification/2.0', roles: ['holder'] },
      ],
    })
  })

  test('Faber asks Alice for revocation notification protocol support synchronously', async () => {
    const matchingFeatures = await faberAgent.didcomm.discovery.queryFeatures({
      connectionId: faberConnection.id,
      protocolVersion: 'v1',
      queries: [{ featureType: 'protocol', match: 'https://didcomm.org/revocation_notification/*' }],
      awaitDisclosures: true,
    })

    expect(matchingFeatures).toMatchObject({
      features: [
        { type: 'protocol', id: 'https://didcomm.org/revocation_notification/1.0', roles: ['holder'] },
        { type: 'protocol', id: 'https://didcomm.org/revocation_notification/2.0', roles: ['holder'] },
      ],
    })
  })
})
