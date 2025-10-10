import type { DidCommConnectionRecord } from '../../connections'
import type {
  DidCommDiscoverFeaturesDisclosureReceivedEvent,
  DidCommDiscoverFeaturesQueryReceivedEvent,
} from '../DidCommDiscoverFeaturesEvents'

import { ReplaySubject } from 'rxjs'

import { Agent } from '../../../../../core/src/agent/Agent'
import { setupSubjectTransports } from '../../../../../core/tests'
import { getAgentOptions, makeConnection } from '../../../../../core/tests/helpers'
import { DidCommFeature, DidCommGoalCode } from '../../../models'
import { DidCommDiscoverFeaturesEventTypes } from '../DidCommDiscoverFeaturesEvents'

import { waitForDisclosureSubject, waitForQuerySubject } from './helpers'

const faberAgentOptions = getAgentOptions(
  'Faber Discover Features V2 E2E',
  {
    endpoints: ['rxjs:faber'],
  },
  undefined,
  undefined,
  { requireDidcomm: true }
)

const aliceAgentOptions = getAgentOptions(
  'Alice Discover Features V2 E2E',
  {
    endpoints: ['rxjs:alice'],
  },
  undefined,
  undefined,
  { requireDidcomm: true }
)

describe('v2 discover features', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let aliceConnection: DidCommConnectionRecord
  let faberConnection: DidCommConnectionRecord

  beforeAll(async () => {
    faberAgent = new Agent(faberAgentOptions)
    aliceAgent = new Agent(aliceAgentOptions)
    setupSubjectTransports([faberAgent, aliceAgent])

    await faberAgent.initialize()
    await aliceAgent.initialize()
    ;[faberConnection, aliceConnection] = await makeConnection(faberAgent, aliceAgent)
  })

  afterAll(async () => {
    await faberAgent.shutdown()
    await aliceAgent.shutdown()
  })

  test('Faber asks Alice for issue credential protocol support', async () => {
    const faberReplay = new ReplaySubject<DidCommDiscoverFeaturesDisclosureReceivedEvent>()
    const aliceReplay = new ReplaySubject<DidCommDiscoverFeaturesQueryReceivedEvent>()

    faberAgent.didcomm.discovery.config.autoAcceptQueries
    faberAgent.events
      .observable<DidCommDiscoverFeaturesDisclosureReceivedEvent>(DidCommDiscoverFeaturesEventTypes.DisclosureReceived)
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
      disclosures: [
        { type: 'protocol', id: 'https://didcomm.org/revocation_notification/1.0', roles: ['holder'] },
        { type: 'protocol', id: 'https://didcomm.org/revocation_notification/2.0', roles: ['holder'] },
      ],
    })
  })

  test('Faber defines a supported goal code and Alice queries', async () => {
    const faberReplay = new ReplaySubject<DidCommDiscoverFeaturesQueryReceivedEvent>()
    const aliceReplay = new ReplaySubject<DidCommDiscoverFeaturesDisclosureReceivedEvent>()

    aliceAgent.events
      .observable<DidCommDiscoverFeaturesDisclosureReceivedEvent>(DidCommDiscoverFeaturesEventTypes.DisclosureReceived)
      .subscribe(aliceReplay)
    faberAgent.events
      .observable<DidCommDiscoverFeaturesQueryReceivedEvent>(DidCommDiscoverFeaturesEventTypes.QueryReceived)
      .subscribe(faberReplay)

    // Register some goal codes
    faberAgent.didcomm.features.register(
      new DidCommGoalCode({ id: 'faber.vc.issuance' }),
      new DidCommGoalCode({ id: 'faber.vc.query' })
    )

    await aliceAgent.didcomm.discovery.queryFeatures({
      connectionId: aliceConnection.id,
      protocolVersion: 'v2',
      queries: [{ featureType: 'goal-code', match: '*' }],
    })

    const query = await waitForQuerySubject(faberReplay, { timeoutMs: 10000 })

    expect(query).toMatchObject({
      protocolVersion: 'v2',
      queries: [{ featureType: 'goal-code', match: '*' }],
    })

    const disclosure = await waitForDisclosureSubject(aliceReplay, { timeoutMs: 10000 })

    expect(disclosure).toMatchObject({
      protocolVersion: 'v2',
      disclosures: [
        { type: 'goal-code', id: 'faber.vc.issuance' },
        { type: 'goal-code', id: 'faber.vc.query' },
      ],
    })
  })

  test('Faber defines a custom feature and Alice queries', async () => {
    const faberReplay = new ReplaySubject<DidCommDiscoverFeaturesQueryReceivedEvent>()
    const aliceReplay = new ReplaySubject<DidCommDiscoverFeaturesDisclosureReceivedEvent>()

    aliceAgent.events
      .observable<DidCommDiscoverFeaturesDisclosureReceivedEvent>(DidCommDiscoverFeaturesEventTypes.DisclosureReceived)
      .subscribe(aliceReplay)
    faberAgent.events
      .observable<DidCommDiscoverFeaturesQueryReceivedEvent>(DidCommDiscoverFeaturesEventTypes.QueryReceived)
      .subscribe(faberReplay)

    // Define a custom feature type
    class GenericFeature extends DidCommFeature {
      public 'generic-field'!: string

      public constructor(options: { id: string; genericField: string }) {
        super({ id: options.id, type: 'generic' })
        this['generic-field'] = options.genericField
      }
    }

    // Register a custom feature
    faberAgent.didcomm.features.register(new GenericFeature({ id: 'custom-feature', genericField: 'custom-field' }))

    await aliceAgent.didcomm.discovery.queryFeatures({
      connectionId: aliceConnection.id,
      protocolVersion: 'v2',
      queries: [{ featureType: 'generic', match: 'custom-feature' }],
    })

    const query = await waitForQuerySubject(faberReplay, { timeoutMs: 10000 })

    expect(query).toMatchObject({
      protocolVersion: 'v2',
      queries: [{ featureType: 'generic', match: 'custom-feature' }],
    })

    const disclosure = await waitForDisclosureSubject(aliceReplay, { timeoutMs: 10000 })

    expect(disclosure).toMatchObject({
      protocolVersion: 'v2',
      disclosures: [
        {
          type: 'generic',
          id: 'custom-feature',
          'generic-field': 'custom-field',
        },
      ],
    })
  })

  test('Faber proactively sends a set of features to Alice', async () => {
    const faberReplay = new ReplaySubject<DidCommDiscoverFeaturesQueryReceivedEvent>()
    const aliceReplay = new ReplaySubject<DidCommDiscoverFeaturesDisclosureReceivedEvent>()

    aliceAgent.events
      .observable<DidCommDiscoverFeaturesDisclosureReceivedEvent>(DidCommDiscoverFeaturesEventTypes.DisclosureReceived)
      .subscribe(aliceReplay)
    faberAgent.events
      .observable<DidCommDiscoverFeaturesQueryReceivedEvent>(DidCommDiscoverFeaturesEventTypes.QueryReceived)
      .subscribe(faberReplay)

    // Register a custom feature
    faberAgent.didcomm.features.register(
      new DidCommFeature({ id: 'AIP2.0', type: 'aip' }),
      new DidCommFeature({ id: 'AIP2.0/INDYCRED', type: 'aip' }),
      new DidCommFeature({ id: 'AIP2.0/MEDIATE', type: 'aip' })
    )

    await faberAgent.didcomm.discovery.discloseFeatures({
      connectionId: faberConnection.id,
      protocolVersion: 'v2',
      disclosureQueries: [{ featureType: 'aip', match: '*' }],
    })

    const disclosure = await waitForDisclosureSubject(aliceReplay, { timeoutMs: 10000 })

    expect(disclosure).toMatchObject({
      protocolVersion: 'v2',
      disclosures: [
        { type: 'aip', id: 'AIP2.0' },
        { type: 'aip', id: 'AIP2.0/INDYCRED' },
        { type: 'aip', id: 'AIP2.0/MEDIATE' },
      ],
    })
  })

  test('Faber asks Alice for issue credential protocol support synchronously', async () => {
    const matchingFeatures = await faberAgent.didcomm.discovery.queryFeatures({
      connectionId: faberConnection.id,
      protocolVersion: 'v2',
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
