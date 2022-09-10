import type { SubjectMessage } from '../../../../../../tests/transport/SubjectInboundTransport'
import type { ConnectionRecord } from '../../connections'
import type {
  DiscoverFeaturesDisclosureReceivedEvent,
  DiscoverFeaturesQueryReceivedEvent,
} from '../DiscoverFeaturesEvents'

import { ReplaySubject, Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../../../../tests/transport/SubjectOutboundTransport'
import { getAgentOptions, makeConnection } from '../../../../tests/helpers'
import { Agent } from '../../../agent/Agent'
import { DiscoverFeaturesEventTypes } from '../DiscoverFeaturesEvents'

import { waitForDisclosureSubject, waitForQuerySubject } from './helpers'

describe('v1 discover features', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let faberConnection: ConnectionRecord

  beforeAll(async () => {
    const faberMessages = new Subject<SubjectMessage>()
    const aliceMessages = new Subject<SubjectMessage>()
    const subjectMap = {
      'rxjs:faber': faberMessages,
      'rxjs:alice': aliceMessages,
    }
    const faberAgentOptions = getAgentOptions('Faber Discover Features V1 E2E', {
      endpoints: ['rxjs:faber'],
    })

    const aliceAgentOptions = getAgentOptions('Alice Discover Features V1 E2E', {
      endpoints: ['rxjs:alice'],
    })
    faberAgent = new Agent(faberAgentOptions)
    faberAgent.registerInboundTransport(new SubjectInboundTransport(faberMessages))
    faberAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await faberAgent.initialize()

    aliceAgent = new Agent(aliceAgentOptions)
    aliceAgent.registerInboundTransport(new SubjectInboundTransport(aliceMessages))
    aliceAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await aliceAgent.initialize()
    ;[faberConnection] = await makeConnection(faberAgent, aliceAgent)
  })

  afterAll(async () => {
    await faberAgent.shutdown()
    await faberAgent.wallet.delete()
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
  })

  test('Faber asks Alice for issue credential protocol support', async () => {
    const faberReplay = new ReplaySubject<DiscoverFeaturesDisclosureReceivedEvent>()
    const aliceReplay = new ReplaySubject<DiscoverFeaturesQueryReceivedEvent>()

    faberAgent.events
      .observable<DiscoverFeaturesDisclosureReceivedEvent>(DiscoverFeaturesEventTypes.DisclosureReceived)
      .subscribe(faberReplay)
    aliceAgent.events
      .observable<DiscoverFeaturesQueryReceivedEvent>(DiscoverFeaturesEventTypes.QueryReceived)
      .subscribe(aliceReplay)

    await faberAgent.discovery.queryFeatures({
      connectionId: faberConnection.id,
      protocolVersion: 'v1',
      queries: [{ featureType: 'protocol', match: 'https://didcomm.org/issue-credential/*' }],
    })

    const query = await waitForQuerySubject(aliceReplay, { timeoutMs: 10000 })

    expect(query).toMatchObject({
      protocolVersion: 'v1',
      queries: [{ featureType: 'protocol', match: 'https://didcomm.org/issue-credential/*' }],
    })

    const disclosure = await waitForDisclosureSubject(faberReplay, { timeoutMs: 10000 })

    expect(disclosure).toMatchObject({
      protocolVersion: 'v1',
      disclosures: [
        { type: 'protocol', id: 'https://didcomm.org/issue-credential/1.0', roles: ['holder', 'issuer'] },
        { type: 'protocol', id: 'https://didcomm.org/issue-credential/2.0', roles: ['holder', 'issuer'] },
      ],
    })
  })

  test('Faber asks Alice for issue credential protocol support synchronously', async () => {
    const matchingFeatures = await faberAgent.discovery.queryFeatures({
      connectionId: faberConnection.id,
      protocolVersion: 'v1',
      queries: [{ featureType: 'protocol', match: 'https://didcomm.org/issue-credential/*' }],
      awaitDisclosures: true,
    })

    expect(matchingFeatures).toMatchObject({
      features: [
        { type: 'protocol', id: 'https://didcomm.org/issue-credential/1.0', roles: ['holder', 'issuer'] },
        { type: 'protocol', id: 'https://didcomm.org/issue-credential/2.0', roles: ['holder', 'issuer'] },
      ],
    })
  })
})
