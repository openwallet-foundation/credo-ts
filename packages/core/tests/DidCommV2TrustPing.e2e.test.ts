import { SubjectOutboundTransport } from '../../../tests/transport/SubjectOutboundTransport'
import type { DidCommConnectionStateChangedEvent } from '../../didcomm/src'
import {
  DidCommBasicMessageEventTypes,
  DidCommConnectionEventTypes,
  DidCommDidExchangeState,
  DidCommEmptyMessage,
  DidCommEventTypes,
  DidCommHandshakeProtocol,
  DidCommProblemReportV2Message,
  DidCommTrustPingEventTypes,
  DidCommTrustPingMessage,
  DidCommTrustPingResponseMessage,
  DidCommTrustPingResponseV2Message,
  DidCommTrustPingV2Message,
} from '../../didcomm/src'
import { DidCommConnectionMetadataKeys } from '../../didcomm/src/modules/connections/repository/DidCommConnectionMetadataTypes'
import { JsonEncoder } from '../src'
import { Agent } from '../src/agent/Agent'
import { setupEventReplaySubjects } from './events'
import {
  getAgentOptions,
  makeConnection,
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

    it('sends trust-ping without response (responseRequested: false) over v2', async () => {
      const [faberConnection] = await makeConnection(faberAgent, aliceAgent, { didCommVersion: 'v2' })
      expect(faberConnection.didcommVersion).toBe('v2')

      const [aliceReplay] = setupEventReplaySubjects([aliceAgent], trustPingEventTypes)
      const ping = await faberAgent.didcomm.connections.sendPing(faberConnection.id, {
        responseRequested: false,
      })
      expect(ping).toBeInstanceOf(DidCommTrustPingV2Message)

      const pingReceived = await waitForTrustPingReceivedEventSubject(aliceReplay, { threadId: ping.threadId })
      expect(pingReceived).toBeInstanceOf(DidCommTrustPingV2Message)
      expect(pingReceived.responseRequested).toBe(false)
    })

    it('bidirectional trust-ping over v2', async () => {
      const [faberConnection, aliceFaberConnection] = await makeConnection(faberAgent, aliceAgent, {
        didCommVersion: 'v2',
      })
      expect(faberConnection.didcommVersion).toBe('v2')

      const [faberReplay, aliceReplay] = setupEventReplaySubjects([faberAgent, aliceAgent], trustPingEventTypes)
      const alicePing = await aliceAgent.didcomm.connections.sendPing(aliceFaberConnection.id, {})
      const faberPing = await faberAgent.didcomm.connections.sendPing(faberConnection.id, {})
      expect(alicePing).toBeInstanceOf(DidCommTrustPingV2Message)
      expect(faberPing).toBeInstanceOf(DidCommTrustPingV2Message)

      const [alicePingReceived, faberPingReceived, aliceResponse, faberResponse] = await Promise.all([
        waitForTrustPingReceivedEventSubject(faberReplay, { threadId: alicePing.threadId }),
        waitForTrustPingReceivedEventSubject(aliceReplay, { threadId: faberPing.threadId }),
        waitForTrustPingResponseReceivedEventSubject(aliceReplay, { threadId: alicePing.threadId }),
        waitForTrustPingResponseReceivedEventSubject(faberReplay, { threadId: faberPing.threadId }),
      ])
      expect(alicePingReceived).toBeInstanceOf(DidCommTrustPingV2Message)
      expect(faberPingReceived).toBeInstanceOf(DidCommTrustPingV2Message)
      expect(aliceResponse).toBeInstanceOf(DidCommTrustPingResponseV2Message)
      expect(aliceResponse.threadId).toBe(alicePing.id)
      expect(faberResponse).toBeInstanceOf(DidCommTrustPingResponseV2Message)
      expect(faberResponse.threadId).toBe(faberPing.id)
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
      expect(aliceFaberConnection.protocol).toBe(DidCommHandshakeProtocol.None)

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
      const attachedPing = new DidCommTrustPingV2Message({ responseRequested: true })
      const faberOutOfBandRecord = await faberAgent.didcomm.oob.createInvitation({
        didCommVersion: 'v2',
        messages: [attachedPing],
      })
      const invitationId = faberOutOfBandRecord.outOfBandInvitation.id

      const invitationUrl = faberOutOfBandRecord.outOfBandInvitation.toUrl({ domain: 'https://example.com' })
      const invitationJson = JsonEncoder.fromBase64Url(new URL(invitationUrl).searchParams.get('_oob') as string)
      expect(invitationJson.attachments[0].data.json).toEqual({
        id: attachedPing.id,
        type: 'https://didcomm.org/trust-ping/2.0/ping',
        body: { response_requested: true },
      })

      const [faberReplay] = setupEventReplaySubjects([faberAgent], trustPingEventTypes)
      const { connectionRecord } = await aliceAgent.didcomm.oob.receiveInvitation(
        faberOutOfBandRecord.outOfBandInvitation,
        { label: 'alice' }
      )
      if (!connectionRecord) throw new Error('Expected connectionRecord to be defined')
      const reply = await waitForTrustPingResponseReceivedEventSubject(faberReplay, {})
      expect(reply).toBeInstanceOf(DidCommTrustPingResponseV2Message)
      expect(reply.thread?.parentThreadId).toBe(invitationId)

      const aliceConnection = await aliceAgent.didcomm.connections.getById(connectionRecord.id)
      expect(aliceConnection.metadata.get(DidCommConnectionMetadataKeys.OutOfBandV2ParentThreadId)).toBeNull()

      const ping = await aliceAgent.didcomm.connections.sendPing(connectionRecord.id, {})
      const pingReceived = await waitForTrustPingReceivedEventSubject(faberReplay, { threadId: ping.threadId })
      expect(pingReceived.thread?.parentThreadId).toBeUndefined()
    })

    const toV2Json = (ping: DidCommTrustPingV2Message) => ({
      id: ping.id,
      type: ping.type,
      body: { response_requested: true },
    })

    const createInvitationUrlWithAttachedData = async (data: object) => {
      const faberOutOfBandRecord = await faberAgent.didcomm.oob.createInvitation({ didCommVersion: 'v2' })
      const invitationJson = {
        ...faberOutOfBandRecord.outOfBandInvitation.v2Invitation?.toJSON(),
        attachments: [{ id: 'request-0', media_type: 'application/json', data }],
      }
      return {
        invitationId: faberOutOfBandRecord.outOfBandInvitation.id,
        invitationUrl: `https://example.com?_oob=${JsonEncoder.toBase64Url(invitationJson)}`,
      }
    }

    it.each([
      ['v2 shaped json', (ping: DidCommTrustPingV2Message) => ({ json: toV2Json(ping) })],
      ['v2 shaped base64', (ping: DidCommTrustPingV2Message) => ({ base64: JsonEncoder.toBase64Url(toV2Json(ping)) })],
      ['body-less json', (ping: DidCommTrustPingV2Message) => ({ json: { id: ping.id, type: ping.type } })],
    ])(
      'v2 OOB with a %s attached request: it is dispatched and the reply carries the invitation id as pthid',
      async (_, toAttachedData) => {
        const ping = new DidCommTrustPingV2Message({ responseRequested: true })
        const { invitationId, invitationUrl } = await createInvitationUrlWithAttachedData(toAttachedData(ping))

        const [faberReplay, aliceReplay] = setupEventReplaySubjects([faberAgent, aliceAgent], trustPingEventTypes)
        const { connectionRecord } = await aliceAgent.didcomm.oob.receiveInvitationFromUrl(invitationUrl, {
          label: 'alice',
        })
        if (!connectionRecord) throw new Error('Expected connectionRecord to be defined')

        const pingReceived = await waitForTrustPingReceivedEventSubject(aliceReplay, { threadId: ping.id })
        expect(pingReceived).toBeInstanceOf(DidCommTrustPingV2Message)
        expect(pingReceived.responseRequested).toBe(true)

        const reply = await waitForTrustPingResponseReceivedEventSubject(faberReplay, { threadId: ping.id })
        expect(reply).toBeInstanceOf(DidCommTrustPingResponseV2Message)
        expect(reply.type).toBe('https://didcomm.org/trust-ping/2.0/ping-response')
        expect(reply.thread?.parentThreadId).toBe(invitationId)
      }
    )

    it('v2 OOB with an attached trust-ping 1.0 request: it is rejected', async () => {
      const ping = new DidCommTrustPingMessage({ responseRequested: true })
      const { invitationUrl } = await createInvitationUrlWithAttachedData({ json: ping.toJSON() })

      const [faberReplay, aliceReplay] = setupEventReplaySubjects(
        [faberAgent, aliceAgent],
        [...trustPingEventTypes, DidCommEventTypes.DidCommMessageProcessed]
      )
      const { connectionRecord } = await aliceAgent.didcomm.oob.receiveInvitationFromUrl(invitationUrl, {
        label: 'alice',
      })
      if (!connectionRecord) throw new Error('Expected connectionRecord to be defined')

      await waitForAgentMessageProcessedEventSubject(aliceReplay, {
        messageType: DidCommTrustPingMessage.type.messageTypeUri,
      })
      const aliceEventTypes: string[] = []
      aliceReplay.subscribe((event) => aliceEventTypes.push(event.type))
      expect(aliceEventTypes).not.toContain(DidCommTrustPingEventTypes.DidCommTrustPingReceivedEvent)

      const problemReport = await waitForAgentMessageProcessedEventSubject(faberReplay, {
        messageType: DidCommProblemReportV2Message.type.messageTypeUri,
      })
      expect(problemReport).toBeInstanceOf(DidCommProblemReportV2Message)
      expect(problemReport).toMatchObject({
        code: 'e.p.msg.message-parse-failure',
        comment: 'Bad message: {1}',
        args: [expect.stringContaining('The message type is not supported over DIDComm v2')],
      })
      expect(problemReport.thread?.parentThreadId).toBe(ping.id)
      expect(problemReport.getLocale()).toBe('en')
    })

    it('v2 OOB (no handshake): a first message sent from the connection state listener carries the pthid', async () => {
      const faberOutOfBandRecord = await faberAgent.didcomm.oob.createInvitation({ didCommVersion: 'v2' })
      const invitationId = faberOutOfBandRecord.outOfBandInvitation.id

      const [faberReplay] = setupEventReplaySubjects([faberAgent], trustPingEventTypes)
      const firstPingSent = new Promise<DidCommTrustPingMessage | DidCommTrustPingV2Message>((resolve, reject) => {
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
    it('v1 connection between v2-capable agents keeps trust-ping 1.0 both ways', async () => {
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
      expect(alicePing).toBeInstanceOf(DidCommTrustPingMessage)
      expect(faberPing).toBeInstanceOf(DidCommTrustPingMessage)

      const [alicePingReceived, faberPingReceived, aliceResponse, faberResponse] = await Promise.all([
        waitForTrustPingReceivedEventSubject(faberReplay, { threadId: alicePing.threadId }),
        waitForTrustPingReceivedEventSubject(aliceReplay, { threadId: faberPing.threadId }),
        waitForTrustPingResponseReceivedEventSubject(aliceReplay, { threadId: alicePing.threadId }),
        waitForTrustPingResponseReceivedEventSubject(faberReplay, { threadId: faberPing.threadId }),
      ])
      expect(alicePingReceived).toBeInstanceOf(DidCommTrustPingMessage)
      expect(faberPingReceived).toBeInstanceOf(DidCommTrustPingMessage)
      expect(aliceResponse).toBeInstanceOf(DidCommTrustPingResponseMessage)
      expect(faberResponse).toBeInstanceOf(DidCommTrustPingResponseMessage)

      await faber.shutdown()
      await alice.shutdown()
    })
  })
})
