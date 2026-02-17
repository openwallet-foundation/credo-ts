import {
  DidCommDidExchangeState,
  DidCommHandshakeProtocol,
} from '../../didcomm/src'
import { Agent } from '../src/agent/Agent'
import {
  getAgentOptions,
  waitForTrustPingReceivedEvent,
  waitForTrustPingResponseReceivedEvent,
} from './helpers'
import { setupSubjectTransports } from './transport'

type DidCommV2Config = { endpoints: string[]; acceptDidCommV2: boolean; sendDidCommV2: boolean }

function createAgents(
  faberName: string,
  aliceName: string,
  faberConfig: DidCommV2Config,
  aliceConfig: DidCommV2Config
) {
  const faber = new Agent(
    getAgentOptions(faberName, faberConfig, undefined, undefined, { requireDidcomm: true })
  )
  const alice = new Agent(
    getAgentOptions(aliceName, aliceConfig, undefined, undefined, { requireDidcomm: true })
  )
  return { faber, alice }
}

const faberAgent = new Agent(
  getAgentOptions(
    'Faber Agent DIDComm v2',
    {
      endpoints: ['rxjs:faber'],
      acceptDidCommV2: true,
      sendDidCommV2: true,
      connections: { autoAcceptConnections: true, autoCreateConnectionOnFirstMessage: true },
    },
    undefined,
    undefined,
    { requireDidcomm: true }
  )
)
const aliceAgent = new Agent(
  getAgentOptions(
    'Alice Agent DIDComm v2',
    {
      endpoints: ['rxjs:alice'],
      acceptDidCommV2: true,
      sendDidCommV2: true,
      connections: { autoAcceptConnections: true, autoCreateConnectionOnFirstMessage: true },
    },
    undefined,
    undefined,
    { requireDidcomm: true }
  )
)

describe('DIDComm trust-ping (v1 and v2)', () => {
  describe('DIDComm v2', () => {
    beforeEach(async () => {
      setupSubjectTransports([faberAgent, aliceAgent])
      await faberAgent.initialize()
      await aliceAgent.initialize()
    })

    afterEach(async () => {
      await faberAgent.shutdown()
      await aliceAgent.shutdown()
    })

    it('invitee sends trust-ping and receives response over v2', async () => {
      const faberOutOfBandRecord = await faberAgent.didcomm.oob.createInvitation({
        handshakeProtocols: [DidCommHandshakeProtocol.Connections],
        multiUseInvitation: true,
      })

      const invitationUrl = faberOutOfBandRecord.outOfBandInvitation.toUrl({ domain: 'https://example.com' })

      let { connectionRecord: aliceFaberConnection } = await aliceAgent.didcomm.oob.receiveInvitationFromUrl(
        invitationUrl,
        { label: 'alice' }
      )
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      aliceFaberConnection = await aliceAgent.didcomm.connections.returnWhenIsConnected(aliceFaberConnection?.id!)
      expect(aliceFaberConnection.state).toBe(DidCommDidExchangeState.Completed)

      const ping = await aliceAgent.didcomm.connections.sendPing(aliceFaberConnection.id, {})

      await waitForTrustPingResponseReceivedEvent(aliceAgent, { threadId: ping.threadId })
    })

    it('inviter sends trust-ping and receives response over v2', async () => {
      const faberOutOfBandRecord = await faberAgent.didcomm.oob.createInvitation({
        handshakeProtocols: [DidCommHandshakeProtocol.Connections],
        multiUseInvitation: true,
      })

      const invitationUrl = faberOutOfBandRecord.outOfBandInvitation.toUrl({ domain: 'https://example.com' })

      let { connectionRecord: aliceFaberConnection } = await aliceAgent.didcomm.oob.receiveInvitationFromUrl(
        invitationUrl,
        { label: 'alice' }
      )
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      aliceFaberConnection = await aliceAgent.didcomm.connections.returnWhenIsConnected(aliceFaberConnection?.id!)
      expect(aliceFaberConnection.state).toBe(DidCommDidExchangeState.Completed)

      const [faberConn] = await faberAgent.didcomm.connections.findAllByOutOfBandId(faberOutOfBandRecord.id)
      expect(faberConn).toBeDefined()
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      const faberConnected = await faberAgent.didcomm.connections.returnWhenIsConnected(faberConn!.id)

      const ping = await faberAgent.didcomm.connections.sendPing(faberConnected.id, {})
      await waitForTrustPingResponseReceivedEvent(faberAgent, { threadId: ping.threadId })
    })

    it('sends trust-ping without response (responseRequested: false) over v2', async () => {
      const faberOutOfBandRecord = await faberAgent.didcomm.oob.createInvitation({
        handshakeProtocols: [DidCommHandshakeProtocol.Connections],
        multiUseInvitation: true,
      })

      const invitationUrl = faberOutOfBandRecord.outOfBandInvitation.toUrl({ domain: 'https://example.com' })

      let { connectionRecord: aliceFaberConnection } = await aliceAgent.didcomm.oob.receiveInvitationFromUrl(
        invitationUrl,
        { label: 'alice' }
      )
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      aliceFaberConnection = await aliceAgent.didcomm.connections.returnWhenIsConnected(aliceFaberConnection?.id!)

      const [faberConn] = await faberAgent.didcomm.connections.findAllByOutOfBandId(faberOutOfBandRecord.id)
      expect(faberConn).toBeDefined()
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      const faberConnected = await faberAgent.didcomm.connections.returnWhenIsConnected(faberConn!.id)

      const ping = await faberAgent.didcomm.connections.sendPing(faberConnected.id, {
        responseRequested: false,
      })

      await waitForTrustPingReceivedEvent(aliceAgent, { threadId: ping.threadId })
      expect(ping.responseRequested).toBe(false)
    })

    it('bidirectional trust-ping over v2', async () => {
      const faberOutOfBandRecord = await faberAgent.didcomm.oob.createInvitation({
        handshakeProtocols: [DidCommHandshakeProtocol.Connections],
        multiUseInvitation: true,
      })

      const invitationUrl = faberOutOfBandRecord.outOfBandInvitation.toUrl({ domain: 'https://example.com' })

      let { connectionRecord: aliceFaberConnection } = await aliceAgent.didcomm.oob.receiveInvitationFromUrl(
        invitationUrl,
        { label: 'alice' }
      )
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      aliceFaberConnection = await aliceAgent.didcomm.connections.returnWhenIsConnected(aliceFaberConnection?.id!)

      const [faberConn] = await faberAgent.didcomm.connections.findAllByOutOfBandId(faberOutOfBandRecord.id)
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      const faberConnected = await faberAgent.didcomm.connections.returnWhenIsConnected(faberConn!.id)

      const alicePing = await aliceAgent.didcomm.connections.sendPing(aliceFaberConnection.id, {})
      const faberPing = await faberAgent.didcomm.connections.sendPing(faberConnected.id, {})

      await Promise.all([
        waitForTrustPingResponseReceivedEvent(aliceAgent, { threadId: alicePing.threadId }),
        waitForTrustPingResponseReceivedEvent(faberAgent, { threadId: faberPing.threadId }),
      ])
    })

    it('v2 OOB (no handshake): Alice receives invitation and gets connection without handshake', async () => {
      const faberOutOfBandRecord = await faberAgent.didcomm.oob.createInvitation({
        didCommVersion: 'v2',
        multiUseInvitation: true,
      })
      const invitationUrl = faberOutOfBandRecord.outOfBandInvitation.toUrl({ domain: 'https://example.com' })

      const { connectionRecord: aliceFaberConnection } = await aliceAgent.didcomm.oob.receiveInvitationFromUrl(
        invitationUrl,
        { label: 'alice' }
      )
      expect(aliceFaberConnection).toBeDefined()
      expect(aliceFaberConnection?.state).toBe(DidCommDidExchangeState.Completed)
      expect(aliceFaberConnection?.protocol).toBe(DidCommHandshakeProtocol.None)
      // v2 OOB: connection is created without handshake (no ConnectionRequest/Response sent)
    })

    it('v2 OOB (no handshake): Alice sends trust-ping and receives response', async () => {
      const faberOutOfBandRecord = await faberAgent.didcomm.oob.createInvitation({
        didCommVersion: 'v2',
        multiUseInvitation: true,
      })
      const invitationUrl = faberOutOfBandRecord.outOfBandInvitation.toUrl({ domain: 'https://example.com' })

      const { connectionRecord: aliceFaberConnection } = await aliceAgent.didcomm.oob.receiveInvitationFromUrl(
        invitationUrl,
        { label: 'alice' }
      )
      expect(aliceFaberConnection).toBeDefined()
      expect(aliceFaberConnection?.state).toBe(DidCommDidExchangeState.Completed)

      const ping = await aliceAgent.didcomm.connections.sendPing(aliceFaberConnection!.id, {})
      await waitForTrustPingResponseReceivedEvent(aliceAgent, { threadId: ping.threadId })
    })
  })

  describe('DIDComm v1', () => {
    it('v1 sender, v2-capable receiver: receives v1 trust-ping (v1 path unchanged)', async () => {
      const { faber, alice } = createAgents(
        'Faber v1 sender',
        'Alice v2 receiver',
        { endpoints: ['rxjs:faber-v1'], acceptDidCommV2: true, sendDidCommV2: false },
        { endpoints: ['rxjs:alice-v1'], acceptDidCommV2: true, sendDidCommV2: true }
      )
      setupSubjectTransports([faber, alice])
      await faber.initialize()
      await alice.initialize()

      const faberOob = await faber.didcomm.oob.createInvitation({
        handshakeProtocols: [DidCommHandshakeProtocol.Connections],
        multiUseInvitation: true,
      })
      const invitationUrl = faberOob.outOfBandInvitation.toUrl({ domain: 'https://example.com' })

      let { connectionRecord: aliceConn } = await alice.didcomm.oob.receiveInvitationFromUrl(invitationUrl, {
        label: 'alice',
      })
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      aliceConn = await alice.didcomm.connections.returnWhenIsConnected(aliceConn?.id!)
      expect(aliceConn.state).toBe(DidCommDidExchangeState.Completed)

      const [faberConn] = await faber.didcomm.connections.findAllByOutOfBandId(faberOob.id)
      expect(faberConn).toBeDefined()
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      const faberConnected = await faber.didcomm.connections.returnWhenIsConnected(faberConn!.id)
      const ping = await faber.didcomm.connections.sendPing(faberConnected.id, {})

      await waitForTrustPingResponseReceivedEvent(faber, { threadId: ping.threadId })

      await faber.shutdown()
      await alice.shutdown()
    })

    it('v1-only: both agents use v1, sends and receives trust-ping', async () => {
      const { faber, alice } = createAgents(
        'Faber v1 only',
        'Alice v1 only',
        { endpoints: ['rxjs:faber-v1only'], acceptDidCommV2: false, sendDidCommV2: false },
        { endpoints: ['rxjs:alice-v1only'], acceptDidCommV2: false, sendDidCommV2: false }
      )
      setupSubjectTransports([faber, alice])
      await faber.initialize()
      await alice.initialize()

      const faberOob = await faber.didcomm.oob.createInvitation({
        handshakeProtocols: [DidCommHandshakeProtocol.Connections],
        multiUseInvitation: true,
      })
      const invitationUrl = faberOob.outOfBandInvitation.toUrl({ domain: 'https://example.com' })

      let { connectionRecord: aliceConn } = await alice.didcomm.oob.receiveInvitationFromUrl(invitationUrl, {
        label: 'alice',
      })
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      aliceConn = await alice.didcomm.connections.returnWhenIsConnected(aliceConn?.id!)

      const ping = await alice.didcomm.connections.sendPing(aliceConn.id, {})
      await waitForTrustPingResponseReceivedEvent(alice, { threadId: ping.threadId })

      await faber.shutdown()
      await alice.shutdown()
    })

    it('v1 inviter sends trust-ping and receives response', async () => {
      const { faber, alice } = createAgents(
        'Faber v1 inviter',
        'Alice v1',
        { endpoints: ['rxjs:faber-v1inv'], acceptDidCommV2: true, sendDidCommV2: false },
        { endpoints: ['rxjs:alice-v1inv'], acceptDidCommV2: true, sendDidCommV2: false }
      )
      setupSubjectTransports([faber, alice])
      await faber.initialize()
      await alice.initialize()

      const faberOob = await faber.didcomm.oob.createInvitation({
        handshakeProtocols: [DidCommHandshakeProtocol.Connections],
        multiUseInvitation: true,
      })
      const invitationUrl = faberOob.outOfBandInvitation.toUrl({ domain: 'https://example.com' })

      let { connectionRecord: aliceConn } = await alice.didcomm.oob.receiveInvitationFromUrl(invitationUrl, {
        label: 'alice',
      })
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      aliceConn = await alice.didcomm.connections.returnWhenIsConnected(aliceConn?.id!)

      const [faberConn] = await faber.didcomm.connections.findAllByOutOfBandId(faberOob.id)
      expect(faberConn).toBeDefined()
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      const faberConnected = await faber.didcomm.connections.returnWhenIsConnected(faberConn!.id)

      const ping = await faber.didcomm.connections.sendPing(faberConnected.id, {})
      await waitForTrustPingResponseReceivedEvent(faber, { threadId: ping.threadId })

      await faber.shutdown()
      await alice.shutdown()
    })

    it('v1 sends trust-ping without response (responseRequested: false)', async () => {
      const { faber, alice } = createAgents(
        'Faber v1 no-resp',
        'Alice v1 no-resp',
        { endpoints: ['rxjs:faber-v1nr'], acceptDidCommV2: true, sendDidCommV2: false },
        { endpoints: ['rxjs:alice-v1nr'], acceptDidCommV2: true, sendDidCommV2: false }
      )
      setupSubjectTransports([faber, alice])
      await faber.initialize()
      await alice.initialize()

      const faberOob = await faber.didcomm.oob.createInvitation({
        handshakeProtocols: [DidCommHandshakeProtocol.Connections],
        multiUseInvitation: true,
      })
      const invitationUrl = faberOob.outOfBandInvitation.toUrl({ domain: 'https://example.com' })

      let { connectionRecord: aliceConn } = await alice.didcomm.oob.receiveInvitationFromUrl(invitationUrl, {
        label: 'alice',
      })
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      aliceConn = await alice.didcomm.connections.returnWhenIsConnected(aliceConn?.id!)

      const [faberConn] = await faber.didcomm.connections.findAllByOutOfBandId(faberOob.id)
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      const faberConnected = await faber.didcomm.connections.returnWhenIsConnected(faberConn!.id)

      const ping = await faber.didcomm.connections.sendPing(faberConnected.id, { responseRequested: false })
      await waitForTrustPingReceivedEvent(alice, { threadId: ping.threadId })
      expect(ping.responseRequested).toBe(false)

      await faber.shutdown()
      await alice.shutdown()
    })

    it('v1 bidirectional trust-ping', async () => {
      const { faber, alice } = createAgents(
        'Faber v1 bi',
        'Alice v1 bi',
        { endpoints: ['rxjs:faber-v1bi'], acceptDidCommV2: true, sendDidCommV2: false },
        { endpoints: ['rxjs:alice-v1bi'], acceptDidCommV2: true, sendDidCommV2: false }
      )
      setupSubjectTransports([faber, alice])
      await faber.initialize()
      await alice.initialize()

      const faberOob = await faber.didcomm.oob.createInvitation({
        handshakeProtocols: [DidCommHandshakeProtocol.Connections],
        multiUseInvitation: true,
      })
      const invitationUrl = faberOob.outOfBandInvitation.toUrl({ domain: 'https://example.com' })

      let { connectionRecord: aliceConn } = await alice.didcomm.oob.receiveInvitationFromUrl(invitationUrl, {
        label: 'alice',
      })
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      aliceConn = await alice.didcomm.connections.returnWhenIsConnected(aliceConn?.id!)

      const [faberConn] = await faber.didcomm.connections.findAllByOutOfBandId(faberOob.id)
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      const faberConnected = await faber.didcomm.connections.returnWhenIsConnected(faberConn!.id)

      const alicePing = await alice.didcomm.connections.sendPing(aliceConn.id, {})
      const faberPing = await faber.didcomm.connections.sendPing(faberConnected.id, {})

      await Promise.all([
        waitForTrustPingResponseReceivedEvent(alice, { threadId: alicePing.threadId }),
        waitForTrustPingResponseReceivedEvent(faber, { threadId: faberPing.threadId }),
      ])

      await faber.shutdown()
      await alice.shutdown()
    })
  })
})
