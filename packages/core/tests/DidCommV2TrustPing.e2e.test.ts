import { SubjectOutboundTransport } from '../../../tests/transport/SubjectOutboundTransport'
import type { DidCommConnectionStateChangedEvent } from '../../didcomm/src'
import {
  DidCommBasicMessageEventTypes,
  DidCommConnectionEventTypes,
  DidCommDidExchangeState,
  DidCommEmptyMessage,
  DidCommEventTypes,
  DidCommHandshakeProtocol,
  DidCommTrustPingEventTypes,
  DidCommTrustPingMessage,
} from '../../didcomm/src'
import { DidCommConnectionMetadataKeys } from '../../didcomm/src/modules/connections/repository/DidCommConnectionMetadataTypes'
import { JsonEncoder } from '../src'
import { Agent } from '../src/agent/Agent'
import { setupEventReplaySubjects } from './events'
import {
  getAgentOptions,
  waitForAgentMessageProcessedEventSubject,
  waitForBasicMessageSubject,
  waitForTrustPingReceivedEventSubject,
  waitForTrustPingResponseReceivedEventSubject,
} from './helpers'
import { setupSubjectTransports } from './transport'

const trustPingEventTypes = [
  DidCommTrustPingEventTypes.DidCommTrustPingReceivedEvent,
  DidCommTrustPingEventTypes.DidCommTrustPingResponseReceivedEvent,
]

type DidCommV2Config = { endpoints: string[]; didcommVersions: ('v1' | 'v2')[] }

function createAgents(
  faberName: string,
  aliceName: string,
  faberConfig: DidCommV2Config,
  aliceConfig: DidCommV2Config
) {
  const faber = new Agent(getAgentOptions(faberName, faberConfig, undefined, undefined, { requireDidcomm: true }))
  const alice = new Agent(getAgentOptions(aliceName, aliceConfig, undefined, undefined, { requireDidcomm: true }))
  return { faber, alice }
}

const faberAgent = new Agent(
  getAgentOptions(
    'Faber Agent DIDComm v2',
    {
      endpoints: ['rxjs:faber'],
      didcommVersions: ['v1', 'v2'],
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
      didcommVersions: ['v1', 'v2'],
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
        handshakeProtocols: [DidCommHandshakeProtocol.DidExchange],
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

      const [aliceReplay] = setupEventReplaySubjects([aliceAgent], trustPingEventTypes)
      const ping = await aliceAgent.didcomm.connections.sendPing(aliceFaberConnection.id, {})

      await waitForTrustPingResponseReceivedEventSubject(aliceReplay, { threadId: ping.threadId })
    })

    it('inviter sends trust-ping and receives response over v2', async () => {
      const faberOutOfBandRecord = await faberAgent.didcomm.oob.createInvitation({
        handshakeProtocols: [DidCommHandshakeProtocol.DidExchange],
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

      const [faberReplay] = setupEventReplaySubjects([faberAgent], trustPingEventTypes)
      const ping = await faberAgent.didcomm.connections.sendPing(faberConnected.id, {})
      await waitForTrustPingResponseReceivedEventSubject(faberReplay, { threadId: ping.threadId })
    })

    it('sends trust-ping without response (responseRequested: false) over v2', async () => {
      const faberOutOfBandRecord = await faberAgent.didcomm.oob.createInvitation({
        handshakeProtocols: [DidCommHandshakeProtocol.DidExchange],
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

      const [aliceReplay] = setupEventReplaySubjects([aliceAgent], trustPingEventTypes)
      const ping = await faberAgent.didcomm.connections.sendPing(faberConnected.id, {
        responseRequested: false,
      })

      await waitForTrustPingReceivedEventSubject(aliceReplay, { threadId: ping.threadId })
      expect(ping.responseRequested).toBe(false)
    })

    it('bidirectional trust-ping over v2', async () => {
      const faberOutOfBandRecord = await faberAgent.didcomm.oob.createInvitation({
        handshakeProtocols: [DidCommHandshakeProtocol.DidExchange],
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

      const [faberReplay, aliceReplay] = setupEventReplaySubjects([faberAgent, aliceAgent], trustPingEventTypes)
      const alicePing = await aliceAgent.didcomm.connections.sendPing(aliceFaberConnection.id, {})
      const faberPing = await faberAgent.didcomm.connections.sendPing(faberConnected.id, {})

      await Promise.all([
        waitForTrustPingResponseReceivedEventSubject(aliceReplay, { threadId: alicePing.threadId }),
        waitForTrustPingResponseReceivedEventSubject(faberReplay, { threadId: faberPing.threadId }),
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
      if (!aliceFaberConnection) throw new Error('Expected aliceFaberConnection to be defined')
      expect(aliceFaberConnection.state).toBe(DidCommDidExchangeState.Completed)

      const [aliceReplay] = setupEventReplaySubjects([aliceAgent], trustPingEventTypes)
      const ping = await aliceAgent.didcomm.connections.sendPing(aliceFaberConnection.id, {})
      await waitForTrustPingResponseReceivedEventSubject(aliceReplay, { threadId: ping.threadId })
    })

    it('v2 OOB (no handshake): only the first message carries the invitation id as pthid', async () => {
      const faberOutOfBandRecord = await faberAgent.didcomm.oob.createInvitation({ didCommVersion: 'v2' })
      const invitationId = faberOutOfBandRecord.outOfBandInvitation.id

      const { connectionRecord } = await aliceAgent.didcomm.oob.receiveInvitation(
        faberOutOfBandRecord.outOfBandInvitation,
        { label: 'alice' }
      )
      if (!connectionRecord) throw new Error('Expected connectionRecord to be defined')

      const [faberReplay, aliceReplay] = setupEventReplaySubjects([faberAgent, aliceAgent], trustPingEventTypes)
      const firstPing = await aliceAgent.didcomm.connections.sendPing(connectionRecord.id, {})
      const firstPingReceived = await waitForTrustPingReceivedEventSubject(faberReplay, {
        threadId: firstPing.threadId,
      })
      expect(firstPingReceived.thread?.parentThreadId).toBe(invitationId)
      await waitForTrustPingResponseReceivedEventSubject(aliceReplay, { threadId: firstPing.threadId })

      const secondPing = await aliceAgent.didcomm.connections.sendPing(connectionRecord.id, {})
      const secondPingReceived = await waitForTrustPingReceivedEventSubject(faberReplay, {
        threadId: secondPing.threadId,
      })
      expect(secondPingReceived.thread?.parentThreadId).toBeUndefined()

      const aliceConnection = await aliceAgent.didcomm.connections.getById(connectionRecord.id)
      expect(aliceConnection.metadata.get(DidCommConnectionMetadataKeys.OutOfBandV2ParentThreadId)).toBeNull()
    })

    it('v2 OOB (no handshake): a first message with its own pthid keeps it', async () => {
      const faberOutOfBandRecord = await faberAgent.didcomm.oob.createInvitation({ didCommVersion: 'v2' })

      const { connectionRecord } = await aliceAgent.didcomm.oob.receiveInvitation(
        faberOutOfBandRecord.outOfBandInvitation,
        { label: 'alice' }
      )
      if (!connectionRecord) throw new Error('Expected connectionRecord to be defined')

      const [faberReplay] = setupEventReplaySubjects(
        [faberAgent],
        [
          ...trustPingEventTypes,
          DidCommBasicMessageEventTypes.DidCommBasicMessageStateChanged,
          DidCommBasicMessageEventTypes.DidCommBasicMessageV2StateChanged,
        ]
      )
      await aliceAgent.didcomm.basicMessages.sendMessage(connectionRecord.id, 'hello', 'custom-pthid')
      const basicMessageReceived = await waitForBasicMessageSubject(faberReplay, { content: 'hello' })
      expect(basicMessageReceived.thread?.parentThreadId).toBe('custom-pthid')

      const ping = await aliceAgent.didcomm.connections.sendPing(connectionRecord.id, {})
      const pingReceived = await waitForTrustPingReceivedEventSubject(faberReplay, { threadId: ping.threadId })
      expect(pingReceived.thread?.parentThreadId).toBeUndefined()
    })

    it('v2 OOB with an attached request: the reply carries the invitation id as pthid', async () => {
      const faberOutOfBandRecord = await faberAgent.didcomm.oob.createInvitation({
        didCommVersion: 'v2',
        messages: [new DidCommTrustPingMessage({ responseRequested: true })],
      })
      const invitationId = faberOutOfBandRecord.outOfBandInvitation.id

      const [faberReplay] = setupEventReplaySubjects([faberAgent], trustPingEventTypes)
      const { connectionRecord } = await aliceAgent.didcomm.oob.receiveInvitation(
        faberOutOfBandRecord.outOfBandInvitation,
        { label: 'alice' }
      )
      if (!connectionRecord) throw new Error('Expected connectionRecord to be defined')
      const reply = await waitForTrustPingResponseReceivedEventSubject(faberReplay, {})
      expect(reply.thread?.parentThreadId).toBe(invitationId)

      const aliceConnection = await aliceAgent.didcomm.connections.getById(connectionRecord.id)
      expect(aliceConnection.metadata.get(DidCommConnectionMetadataKeys.OutOfBandV2ParentThreadId)).toBeNull()

      const ping = await aliceAgent.didcomm.connections.sendPing(connectionRecord.id, {})
      const pingReceived = await waitForTrustPingReceivedEventSubject(faberReplay, { threadId: ping.threadId })
      expect(pingReceived.thread?.parentThreadId).toBeUndefined()
    })

    it('v2 OOB (no handshake): a first message sent from the connection state listener carries the pthid', async () => {
      const faberOutOfBandRecord = await faberAgent.didcomm.oob.createInvitation({ didCommVersion: 'v2' })
      const invitationId = faberOutOfBandRecord.outOfBandInvitation.id

      const [faberReplay] = setupEventReplaySubjects([faberAgent], trustPingEventTypes)
      const firstPingSent = new Promise<DidCommTrustPingMessage>((resolve, reject) => {
        const listener = ({ payload }: DidCommConnectionStateChangedEvent) => {
          aliceAgent.events.off(DidCommConnectionEventTypes.DidCommConnectionStateChanged, listener)
          aliceAgent.didcomm.connections.sendPing(payload.connectionRecord.id, {}).then(resolve, reject)
        }
        aliceAgent.events.on(DidCommConnectionEventTypes.DidCommConnectionStateChanged, listener)
      })

      const { connectionRecord } = await aliceAgent.didcomm.oob.receiveInvitation(
        faberOutOfBandRecord.outOfBandInvitation,
        { label: 'alice' }
      )
      if (!connectionRecord) throw new Error('Expected connectionRecord to be defined')

      const firstPing = await firstPingSent
      const firstPingReceived = await waitForTrustPingReceivedEventSubject(faberReplay, {
        threadId: firstPing.threadId,
      })
      expect(firstPingReceived.thread?.parentThreadId).toBe(invitationId)

      const secondPing = await aliceAgent.didcomm.connections.sendPing(connectionRecord.id, {})
      const secondPingReceived = await waitForTrustPingReceivedEventSubject(faberReplay, {
        threadId: secondPing.threadId,
      })
      expect(secondPingReceived.thread?.parentThreadId).toBeUndefined()
    })

    it('v2 OOB (no handshake): a rotation sent as the first message carries the pthid', async () => {
      const faberOutOfBandRecord = await faberAgent.didcomm.oob.createInvitation({ didCommVersion: 'v2' })
      const invitationId = faberOutOfBandRecord.outOfBandInvitation.id

      const { connectionRecord } = await aliceAgent.didcomm.oob.receiveInvitation(
        faberOutOfBandRecord.outOfBandInvitation,
        { label: 'alice' }
      )
      if (!connectionRecord) throw new Error('Expected connectionRecord to be defined')

      const [faberReplay] = setupEventReplaySubjects([faberAgent], [DidCommEventTypes.DidCommMessageProcessed])
      await aliceAgent.didcomm.connections.rotate({ connectionId: connectionRecord.id })
      const emptyMessage = await waitForAgentMessageProcessedEventSubject(faberReplay, {
        messageType: DidCommEmptyMessage.type.messageTypeUri,
      })
      expect(emptyMessage.thread?.parentThreadId).toBe(invitationId)
    })

    it('v2 OOB (no handshake): a first message that fails to send leaves the pthid for the retry', async () => {
      const faberOutOfBandRecord = await faberAgent.didcomm.oob.createInvitation({ didCommVersion: 'v2' })
      const invitationId = faberOutOfBandRecord.outOfBandInvitation.id

      const { connectionRecord } = await aliceAgent.didcomm.oob.receiveInvitation(
        faberOutOfBandRecord.outOfBandInvitation,
        { label: 'alice' }
      )
      if (!connectionRecord) throw new Error('Expected connectionRecord to be defined')

      const sendSpy = vi
        .spyOn(SubjectOutboundTransport.prototype, 'sendMessage')
        .mockRejectedValueOnce(new Error('offline'))
      await expect(aliceAgent.didcomm.connections.sendPing(connectionRecord.id, {})).rejects.toThrow(/undeliverable/)
      sendSpy.mockRestore()

      const [faberReplay] = setupEventReplaySubjects([faberAgent], trustPingEventTypes)
      const ping = await aliceAgent.didcomm.connections.sendPing(connectionRecord.id, {})
      const pingReceived = await waitForTrustPingReceivedEventSubject(faberReplay, { threadId: ping.threadId })
      expect(pingReceived.thread?.parentThreadId).toBe(invitationId)
    })

    it('v2 OOB (no handshake): an invitation id that is not a valid pthid does not block the first message', async () => {
      const faberOutOfBandRecord = await faberAgent.didcomm.oob.createInvitation({ didCommVersion: 'v2' })
      const v2Invitation = faberOutOfBandRecord.outOfBandInvitation.v2Invitation
      if (!v2Invitation) throw new Error('Expected v2Invitation to be defined')
      const invitationUrl = `https://example.com?_oob=${JsonEncoder.toBase64Url({
        ...v2Invitation.toJSON(),
        id: 'inv~0123456789',
      })}`

      const { connectionRecord } = await aliceAgent.didcomm.oob.receiveInvitationFromUrl(invitationUrl, {
        label: 'alice',
      })
      if (!connectionRecord) throw new Error('Expected connectionRecord to be defined')

      const [faberReplay] = setupEventReplaySubjects([faberAgent], trustPingEventTypes)
      const ping = await aliceAgent.didcomm.connections.sendPing(connectionRecord.id, {})
      const pingReceived = await waitForTrustPingReceivedEventSubject(faberReplay, { threadId: ping.threadId })
      expect(pingReceived.thread?.parentThreadId).toBeUndefined()
    })
  })

  describe('DIDComm v1', () => {
    it('v1 sender, v2-capable receiver: receives v1 trust-ping (v1 path unchanged)', async () => {
      const { faber, alice } = createAgents(
        'Faber v1 sender',
        'Alice v2 receiver',
        { endpoints: ['rxjs:faber-v1'], didcommVersions: ['v1', 'v2'] },
        { endpoints: ['rxjs:alice-v1'], didcommVersions: ['v1', 'v2'] }
      )
      setupSubjectTransports([faber, alice])
      await faber.initialize()
      await alice.initialize()

      const faberOob = await faber.didcomm.oob.createInvitation({
        handshakeProtocols: [DidCommHandshakeProtocol.DidExchange],
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
      const [faberReplay] = setupEventReplaySubjects([faber], trustPingEventTypes)
      const ping = await faber.didcomm.connections.sendPing(faberConnected.id, {})

      await waitForTrustPingResponseReceivedEventSubject(faberReplay, { threadId: ping.threadId })

      await faber.shutdown()
      await alice.shutdown()
    })

    it('v1-only: both agents use v1, sends and receives trust-ping', async () => {
      const { faber, alice } = createAgents(
        'Faber v1 only',
        'Alice v1 only',
        { endpoints: ['rxjs:faber-v1only'], didcommVersions: ['v1'] },
        { endpoints: ['rxjs:alice-v1only'], didcommVersions: ['v1'] }
      )
      setupSubjectTransports([faber, alice])
      await faber.initialize()
      await alice.initialize()

      const faberOob = await faber.didcomm.oob.createInvitation({
        handshakeProtocols: [DidCommHandshakeProtocol.DidExchange],
        multiUseInvitation: true,
      })
      const invitationUrl = faberOob.outOfBandInvitation.toUrl({ domain: 'https://example.com' })

      let { connectionRecord: aliceConn } = await alice.didcomm.oob.receiveInvitationFromUrl(invitationUrl, {
        label: 'alice',
      })
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      aliceConn = await alice.didcomm.connections.returnWhenIsConnected(aliceConn?.id!)

      const [aliceReplay] = setupEventReplaySubjects([alice], trustPingEventTypes)
      const ping = await alice.didcomm.connections.sendPing(aliceConn.id, {})
      await waitForTrustPingResponseReceivedEventSubject(aliceReplay, { threadId: ping.threadId })

      await faber.shutdown()
      await alice.shutdown()
    })

    it('v1 inviter sends trust-ping and receives response', async () => {
      const { faber, alice } = createAgents(
        'Faber v1 inviter',
        'Alice v1',
        { endpoints: ['rxjs:faber-v1inv'], didcommVersions: ['v1', 'v2'] },
        { endpoints: ['rxjs:alice-v1inv'], didcommVersions: ['v1', 'v2'] }
      )
      setupSubjectTransports([faber, alice])
      await faber.initialize()
      await alice.initialize()

      const faberOob = await faber.didcomm.oob.createInvitation({
        handshakeProtocols: [DidCommHandshakeProtocol.DidExchange],
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

      const [faberReplay] = setupEventReplaySubjects([faber], trustPingEventTypes)
      const ping = await faber.didcomm.connections.sendPing(faberConnected.id, {})
      await waitForTrustPingResponseReceivedEventSubject(faberReplay, { threadId: ping.threadId })

      await faber.shutdown()
      await alice.shutdown()
    })

    it('v1 sends trust-ping without response (responseRequested: false)', async () => {
      const { faber, alice } = createAgents(
        'Faber v1 no-resp',
        'Alice v1 no-resp',
        { endpoints: ['rxjs:faber-v1nr'], didcommVersions: ['v1', 'v2'] },
        { endpoints: ['rxjs:alice-v1nr'], didcommVersions: ['v1', 'v2'] }
      )
      setupSubjectTransports([faber, alice])
      await faber.initialize()
      await alice.initialize()

      const faberOob = await faber.didcomm.oob.createInvitation({
        handshakeProtocols: [DidCommHandshakeProtocol.DidExchange],
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

      const [aliceReplay] = setupEventReplaySubjects([alice], trustPingEventTypes)
      const ping = await faber.didcomm.connections.sendPing(faberConnected.id, { responseRequested: false })
      await waitForTrustPingReceivedEventSubject(aliceReplay, { threadId: ping.threadId })
      expect(ping.responseRequested).toBe(false)

      await faber.shutdown()
      await alice.shutdown()
    })

    it('v1 bidirectional trust-ping', async () => {
      const { faber, alice } = createAgents(
        'Faber v1 bi',
        'Alice v1 bi',
        { endpoints: ['rxjs:faber-v1bi'], didcommVersions: ['v1', 'v2'] },
        { endpoints: ['rxjs:alice-v1bi'], didcommVersions: ['v1', 'v2'] }
      )
      setupSubjectTransports([faber, alice])
      await faber.initialize()
      await alice.initialize()

      const faberOob = await faber.didcomm.oob.createInvitation({
        handshakeProtocols: [DidCommHandshakeProtocol.DidExchange],
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

      const [faberReplay, aliceReplay] = setupEventReplaySubjects([faber, alice], trustPingEventTypes)
      const alicePing = await alice.didcomm.connections.sendPing(aliceConn.id, {})
      const faberPing = await faber.didcomm.connections.sendPing(faberConnected.id, {})

      await Promise.all([
        waitForTrustPingResponseReceivedEventSubject(aliceReplay, { threadId: alicePing.threadId }),
        waitForTrustPingResponseReceivedEventSubject(faberReplay, { threadId: faberPing.threadId }),
      ])

      await faber.shutdown()
      await alice.shutdown()
    })
  })
})
