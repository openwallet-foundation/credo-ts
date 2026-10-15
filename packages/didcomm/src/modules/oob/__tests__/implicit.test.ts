import { type DidDocumentKey, getDidPeer4ShortFormForEquivalence, Kms } from '@credo-ts/core'
import { convertPublicKeyToX25519 } from '@stablelib/ed25519'
import { Agent } from '../../../../../core/src/agent/Agent'
import {
  DidCommV1Service,
  DidDocumentBuilder,
  DidDocumentService,
  DidsModule,
  getEd25519VerificationKey2018,
  getX25519KeyAgreementKey2019,
  NewDidCommV2Service,
  NewDidCommV2ServiceEndpoint,
} from '../../../../../core/src/modules/dids'
import { isValidUuid } from '../../../../../core/src/utils/uuid'
import { type EventReplaySubject, setupEventReplaySubjects, setupSubjectTransports } from '../../../../../core/tests'
import {
  getAgentOptions,
  waitForBasicMessageSubject,
  waitForConnectionRecordSubject,
  waitForDidRotateSubject,
  waitForTrustPingReceivedEventSubject,
  waitForTrustPingResponseReceivedEventSubject,
} from '../../../../../core/tests/helpers'
import { DidCommEnvelopeRegistry } from '../../../envelope'
import { DidCommBasicMessageEventTypes } from '../../basic-messages'
import {
  DidCommConnectionEventTypes,
  DidCommDidExchangeState,
  DidCommHandshakeProtocol,
  DidCommTrustPingEventTypes,
  DidCommTrustPingV2Message,
} from '../../connections'
import { InMemoryDidRegistry } from '../../connections/__tests__/InMemoryDidRegistry'
import { DidCommOutOfBandService } from '../DidCommOutOfBandService'
import { DidCommOutOfBandState } from '../domain'

const inMemoryDidsRegistry = new InMemoryDidRegistry()

const faberAgentOptions = getAgentOptions(
  'Faber Agent OOB Implicit',
  {
    endpoints: ['rxjs:faber'],
    didcommVersions: ['v1', 'v2'],
    connections: { autoAcceptConnections: true, autoCreateConnectionOnFirstMessage: true },
  },
  {},
  {
    dids: new DidsModule({
      resolvers: [inMemoryDidsRegistry],
      registrars: [inMemoryDidsRegistry],
    }),
  },
  { requireDidcomm: true }
)
const aliceAgentOptions = getAgentOptions(
  'Alice Agent OOB Implicit',
  {
    endpoints: ['rxjs:alice'],
    didcommVersions: ['v1', 'v2'],
  },
  {},
  {
    dids: new DidsModule({
      resolvers: [inMemoryDidsRegistry],
      registrars: [inMemoryDidsRegistry],
    }),
  },
  { requireDidcomm: true }
)

describe('out of band implicit', () => {
  let faberAgent: Agent<typeof faberAgentOptions.modules>
  let aliceAgent: Agent<typeof aliceAgentOptions.modules>
  let faberReplay: EventReplaySubject
  let faberMessageReplay: EventReplaySubject

  beforeAll(async () => {
    faberAgent = new Agent(faberAgentOptions)
    aliceAgent = new Agent(aliceAgentOptions)

    setupSubjectTransports([faberAgent, aliceAgent])
    await faberAgent.initialize()
    await aliceAgent.initialize()

    ;[faberReplay] = setupEventReplaySubjects([faberAgent], [DidCommConnectionEventTypes.DidCommConnectionStateChanged])
    ;[faberMessageReplay] = setupEventReplaySubjects(
      [faberAgent],
      [
        DidCommBasicMessageEventTypes.DidCommBasicMessageStateChanged,
        DidCommBasicMessageEventTypes.DidCommBasicMessageV2StateChanged,
      ]
    )
  })

  afterAll(async () => {
    await faberAgent.shutdown()
    await aliceAgent.shutdown()
  })

  afterEach(async () => {
    const connections = await faberAgent.didcomm.connections.getAll()
    for (const connection of connections) {
      await faberAgent.didcomm.connections.deleteById(connection.id)
    }

    vi.resetAllMocks()
  })

  test('v2 implicit invitation: completed connection without DID Exchange handshake', async () => {
    const inMemoryDid = await createInMemoryDid(faberAgent, 'rxjs:faber')

    const { connectionRecord: aliceFaberConnection, outOfBandRecord } =
      await aliceAgent.didcomm.oob.receiveImplicitInvitation({
        did: inMemoryDid,
        didCommVersion: 'v2',
        alias: 'Faber public',
        label: 'Custom Alice',
      })

    expect(aliceFaberConnection).toBeDefined()
    expect(aliceFaberConnection?.state).toBe(DidCommDidExchangeState.Completed)
    expect(aliceFaberConnection?.didcommVersion).toBe('v2')
    expect(aliceFaberConnection?.invitationDid).toBe(inMemoryDid)
    expect(outOfBandRecord.outOfBandInvitation.v2Invitation?.from).toBe(inMemoryDid)
    expect(outOfBandRecord.outOfBandInvitation.v2Invitation?.body?.accept).toEqual(['didcomm/v2'])
  })

  test('v2 implicit invitation: first message has no pthid', async () => {
    const inMemoryDid = await createInMemoryDid(faberAgent, 'rxjs:faber')

    const { connectionRecord } = await aliceAgent.didcomm.oob.receiveImplicitInvitation({
      did: inMemoryDid,
      didCommVersion: 'v2',
      label: 'Alice',
    })
    if (!connectionRecord) throw new Error('Expected connectionRecord to be defined')

    const ping = await aliceAgent.didcomm.connections.sendPing(connectionRecord.id, { responseRequested: false })
    expect(ping.thread?.parentThreadId).toBeUndefined()
  })

  test('v2 implicit invitation: first messages that arrive at the same time create one connection', async () => {
    const inMemoryDid = await createInMemoryDid(faberAgent, 'rxjs:faber', { withKeyAgreement: true })
    const { connectionRecord: aliceFaberConnection } = await aliceAgent.didcomm.oob.receiveImplicitInvitation({
      did: inMemoryDid,
      didCommVersion: 'v2',
      label: 'alice',
    })
    if (!aliceFaberConnection) throw new Error('Expected a connection')
    const peerDidsBefore = await faberAgent.dids.getCreatedDids({ method: 'peer' })

    await Promise.all([
      aliceAgent.didcomm.basicMessages.sendMessage(aliceFaberConnection.id, 'first'),
      aliceAgent.didcomm.basicMessages.sendMessage(aliceFaberConnection.id, 'second'),
    ])
    await waitForBasicMessageSubject(faberMessageReplay, { content: 'first' })
    await waitForBasicMessageSubject(faberMessageReplay, { content: 'second' })

    const faberConnections = await faberAgent.didcomm.connections.findAllByQuery({ theirDid: aliceFaberConnection.did })
    expect(faberConnections).toHaveLength(1)
    expect(isValidUuid(faberConnections[0].id)).toBe(true)
    expect(faberConnections[0].did).not.toBe(inMemoryDid)
    expect(
      await faberAgent.didcomm.basicMessages.findAllByQuery({ connectionId: faberConnections[0].id })
    ).toHaveLength(2)
    expect(await faberAgent.dids.getCreatedDids({ method: 'peer' })).toHaveLength(peerDidsBefore.length + 1)
  })

  test('v2 implicit invitation: first messages that use both did:peer:4 forms create one connection', async () => {
    const inMemoryDid = await createInMemoryDid(faberAgent, 'rxjs:faber', { withKeyAgreement: true })
    const { connectionRecord: aliceFaberConnection } = await aliceAgent.didcomm.oob.receiveImplicitInvitation({
      did: inMemoryDid,
      didCommVersion: 'v2',
      label: 'alice',
    })
    const aliceShortDid = aliceFaberConnection?.did && getDidPeer4ShortFormForEquivalence(aliceFaberConnection.did)
    if (!aliceFaberConnection || !aliceShortDid) throw new Error('Expected a did:peer:4 connection')

    const envelope = faberAgent.dependencyManager.resolve(DidCommEnvelopeRegistry).getEnvelopeForDidCommVersion('v2')
    const unpack = envelope.unpack.bind(envelope)
    let unpacked = 0
    const spy = vi.spyOn(envelope, 'unpack').mockImplementation(async (context, message) => {
      const decrypted = await unpack(context, message)
      return ++unpacked === 2 ? { ...decrypted, authenticatedSenderDid: aliceShortDid } : decrypted
    })

    try {
      await Promise.all([
        aliceAgent.didcomm.basicMessages.sendMessage(aliceFaberConnection.id, 'mixed forms 1'),
        aliceAgent.didcomm.basicMessages.sendMessage(aliceFaberConnection.id, 'mixed forms 2'),
      ])
      await waitForBasicMessageSubject(faberMessageReplay, { content: 'mixed forms 1' })
      await waitForBasicMessageSubject(faberMessageReplay, { content: 'mixed forms 2' })
    } finally {
      spy.mockRestore()
    }

    const faberConnections = await faberAgent.didcomm.connections.findAllByQuery({ invitationDid: inMemoryDid })
    expect(faberConnections).toHaveLength(1)
    expect(
      await faberAgent.didcomm.basicMessages.findAllByQuery({ connectionId: faberConnections[0].id })
    ).toHaveLength(2)
  })

  test('v2 implicit invitation: a peer reusing its DID after hanging up gets one new connection', async () => {
    const inMemoryDid = await createInMemoryDid(faberAgent, 'rxjs:faber', { withKeyAgreement: true })
    const { connectionRecord: firstConnection } = await aliceAgent.didcomm.oob.receiveImplicitInvitation({
      did: inMemoryDid,
      didCommVersion: 'v2',
      label: 'alice',
    })
    if (!firstConnection?.did) throw new Error('Expected a connection')

    await aliceAgent.didcomm.basicMessages.sendMessage(firstConnection.id, 'before hangup')
    await waitForBasicMessageSubject(faberMessageReplay, { content: 'before hangup' })
    const [oldFaberConnection] = await faberAgent.didcomm.connections.findAllByQuery({ theirDid: firstConnection.did })

    const [faberRotateReplay] = setupEventReplaySubjects(
      [faberAgent],
      [DidCommConnectionEventTypes.DidCommConnectionDidRotated]
    )
    await aliceAgent.didcomm.connections.hangup({ connectionId: firstConnection.id })
    await waitForDidRotateSubject(faberRotateReplay, {})

    const { connectionRecord: secondConnection } = await aliceAgent.didcomm.oob.receiveImplicitInvitation({
      did: inMemoryDid,
      didCommVersion: 'v2',
      label: 'alice',
      ourDid: firstConnection.did,
    })
    if (!secondConnection) throw new Error('Expected a connection')

    await Promise.all([
      aliceAgent.didcomm.basicMessages.sendMessage(secondConnection.id, 'after hangup 1'),
      aliceAgent.didcomm.basicMessages.sendMessage(secondConnection.id, 'after hangup 2'),
    ])
    await waitForBasicMessageSubject(faberMessageReplay, { content: 'after hangup 1' })
    await waitForBasicMessageSubject(faberMessageReplay, { content: 'after hangup 2' })

    const faberConnections = await faberAgent.didcomm.connections.findAllByQuery({ theirDid: firstConnection.did })
    expect(faberConnections).toHaveLength(1)
    expect(faberConnections[0].id).not.toBe(oldFaberConnection.id)
    expect(
      await faberAgent.didcomm.basicMessages.findAllByQuery({ connectionId: faberConnections[0].id })
    ).toHaveLength(2)
  })

  test('v2 implicit invitation: a peer that rotated off its public DID and lost its state gets a new connection', async () => {
    const faberDid = await createInMemoryDid(faberAgent, 'rxjs:faber', { withKeyAgreement: true })
    const aliceDid = await createInMemoryDid(aliceAgent, 'rxjs:alice', { withKeyAgreement: true })
    const { connectionRecord: firstConnection } = await aliceAgent.didcomm.oob.receiveImplicitInvitation({
      did: faberDid,
      didCommVersion: 'v2',
      label: 'alice',
      ourDid: aliceDid,
    })
    if (!firstConnection) throw new Error('Expected a connection')

    await aliceAgent.didcomm.basicMessages.sendMessage(firstConnection.id, 'before restart')
    await waitForBasicMessageSubject(faberMessageReplay, { content: 'before restart' })

    const [faberRotateReplay] = setupEventReplaySubjects(
      [faberAgent],
      [DidCommConnectionEventTypes.DidCommConnectionDidRotated]
    )
    await aliceAgent.didcomm.connections.rotate({ connectionId: firstConnection.id })
    await waitForDidRotateSubject(faberRotateReplay, {})
    const [oldFaberConnection] = await faberAgent.didcomm.connections.findAllByQuery({ invitationDid: faberDid })
    expect(oldFaberConnection.did).not.toBe(faberDid)
    expect(oldFaberConnection.previousTheirDids).toEqual([aliceDid])

    await aliceAgent.didcomm.connections.deleteById(firstConnection.id)
    const { connectionRecord: secondConnection } = await aliceAgent.didcomm.oob.receiveImplicitInvitation({
      did: faberDid,
      didCommVersion: 'v2',
      label: 'alice',
      ourDid: aliceDid,
    })
    if (!secondConnection) throw new Error('Expected a connection')

    await Promise.all([
      aliceAgent.didcomm.basicMessages.sendMessage(secondConnection.id, 'after restart 1'),
      aliceAgent.didcomm.basicMessages.sendMessage(secondConnection.id, 'after restart 2'),
    ])
    await waitForBasicMessageSubject(faberMessageReplay, { content: 'after restart 1' })
    await waitForBasicMessageSubject(faberMessageReplay, { content: 'after restart 2' })

    const faberConnections = await faberAgent.didcomm.connections.findAllByQuery({ theirDid: aliceDid })
    expect(faberConnections).toHaveLength(1)
    expect(
      await faberAgent.didcomm.basicMessages.findAllByQuery({ connectionId: faberConnections[0].id })
    ).toHaveLength(2)
    expect(await faberAgent.didcomm.connections.getById(oldFaberConnection.id)).toMatchObject({
      state: DidCommDidExchangeState.Completed,
      theirDid: oldFaberConnection.theirDid,
    })
  })

  test('v2 single-use invitation: a first message racing the one that used up the invitation gets its connection', async () => {
    const outOfBandRecord = await faberAgent.didcomm.oob.createInvitation({
      didCommVersion: 'v2',
      multiUseInvitation: false,
    })
    const { connectionRecord: aliceFaberConnection } = await aliceAgent.didcomm.oob.receiveInvitation(
      outOfBandRecord.outOfBandInvitation,
      { label: 'alice' }
    )
    if (!aliceFaberConnection) throw new Error('Expected a connection')

    // Both messages pass the connection lookup before either creates the connection, and the second one only
    // looks for the invitation after the first has marked it Done
    const outOfBandService = faberAgent.dependencyManager.resolve(DidCommOutOfBandService)
    const findCreatedByRecipientDid = outOfBandService.findCreatedByRecipientDid.bind(outOfBandService)
    let secondLookupStarted: () => void = () => {}
    const secondLookup = new Promise<void>((resolve) => {
      secondLookupStarted = resolve
    })
    let lookups = 0
    const spy = vi.spyOn(outOfBandService, 'findCreatedByRecipientDid').mockImplementation(async (...args) => {
      lookups++
      if (lookups === 1) {
        await secondLookup
      } else {
        secondLookupStarted()
        while ((await faberAgent.didcomm.oob.getById(outOfBandRecord.id)).state !== DidCommOutOfBandState.Done) {
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
      }
      return findCreatedByRecipientDid(...args)
    })

    try {
      await Promise.all([
        aliceAgent.didcomm.basicMessages.sendMessage(aliceFaberConnection.id, 'single use 1'),
        aliceAgent.didcomm.basicMessages.sendMessage(aliceFaberConnection.id, 'single use 2'),
      ])
      await waitForBasicMessageSubject(faberMessageReplay, { content: 'single use 1' })
      await waitForBasicMessageSubject(faberMessageReplay, { content: 'single use 2' })
    } finally {
      spy.mockRestore()
    }

    const faberConnections = await faberAgent.didcomm.connections.findAllByOutOfBandId(outOfBandRecord.id)
    expect(faberConnections).toHaveLength(1)
    expect(
      await faberAgent.didcomm.basicMessages.findAllByQuery({ connectionId: faberConnections[0].id })
    ).toHaveLength(2)
  })

  test('v2 invitations under one DID: a first message binds to the invitation its pthid names', async () => {
    const publicDid = await createInMemoryDid(faberAgent, 'rxjs:faber', { withKeyAgreement: true })
    const older = await faberAgent.didcomm.oob.createInvitation({ didCommVersion: 'v2', ourDid: publicDid })
    const newer = await faberAgent.didcomm.oob.createInvitation({ didCommVersion: 'v2', ourDid: publicDid })

    const { connectionRecord } = await aliceAgent.didcomm.oob.receiveInvitation(older.outOfBandInvitation, {
      label: 'alice',
    })
    if (!connectionRecord) throw new Error('Expected a connection')
    await aliceAgent.didcomm.basicMessages.sendMessage(connectionRecord.id, 'accepts the older invitation')
    await waitForBasicMessageSubject(faberMessageReplay, { content: 'accepts the older invitation' })

    expect(await faberAgent.didcomm.connections.findAllByOutOfBandId(older.id)).toHaveLength(1)
    expect((await faberAgent.didcomm.oob.getById(older.id)).state).toBe(DidCommOutOfBandState.Done)
    expect((await faberAgent.didcomm.oob.getById(newer.id)).state).toBe(DidCommOutOfBandState.AwaitResponse)
  })

  test('v2 implicit invitation: a first message whose pthid names no invitation gets a connection without one', async () => {
    const publicDid = await createInMemoryDid(faberAgent, 'rxjs:faber', { withKeyAgreement: true })
    const { connectionRecord: implicitConnection } = await aliceAgent.didcomm.oob.receiveImplicitInvitation({
      did: publicDid,
      didCommVersion: 'v2',
      label: 'alice',
    })
    if (!implicitConnection) throw new Error('Expected a connection')
    const warn = vi.spyOn(faberAgent.config.logger, 'warn')
    try {
      await aliceAgent.didcomm.basicMessages.sendMessage(implicitConnection.id, 'names no invitation', 'unknown')
      await waitForBasicMessageSubject(faberMessageReplay, { content: 'names no invitation' })
      expect(warn).toHaveBeenCalledWith(expect.any(String), { pthid: 'unknown', senderDid: implicitConnection.did })
    } finally {
      warn.mockRestore()
    }

    const faberConnections = await faberAgent.didcomm.connections.findAllByQuery({ theirDid: implicitConnection.did })
    expect(faberConnections).toHaveLength(1)
    expect(faberConnections[0].outOfBandId).toBeUndefined()
  })

  test('v2 invitation with reuseConnection: the next message on the existing connection names the invitation', async () => {
    const publicDid = await createInMemoryDid(faberAgent, 'rxjs:faber', { withKeyAgreement: true })
    const firstInvitation = await faberAgent.didcomm.oob.createInvitation({
      didCommVersion: 'v2',
      ourDid: publicDid,
      multiUseInvitation: true,
    })
    const { connectionRecord: existingConnection } = await aliceAgent.didcomm.oob.receiveInvitation(
      firstInvitation.outOfBandInvitation,
      { label: 'alice' }
    )
    if (!existingConnection) throw new Error('Expected a connection')
    const [aliceReplay] = setupEventReplaySubjects(
      [aliceAgent],
      [DidCommTrustPingEventTypes.DidCommTrustPingResponseReceivedEvent]
    )
    const firstPing = await aliceAgent.didcomm.connections.sendPing(existingConnection.id, {})
    await waitForTrustPingResponseReceivedEventSubject(aliceReplay, { threadId: firstPing.threadId })
    expect((await aliceAgent.didcomm.connections.getById(existingConnection.id)).theirDid).not.toBe(publicDid)

    const secondInvitation = await faberAgent.didcomm.oob.createInvitation({ didCommVersion: 'v2', ourDid: publicDid })
    const { connectionRecord, outOfBandRecord } = await aliceAgent.didcomm.oob.receiveInvitation(
      secondInvitation.outOfBandInvitation,
      { label: 'alice', reuseConnection: true }
    )
    expect(connectionRecord?.id).toBe(existingConnection.id)
    expect(await aliceAgent.didcomm.connections.findByInvitationDid(publicDid)).toHaveLength(1)
    expect(outOfBandRecord.state).toBe(DidCommOutOfBandState.Done)

    const [faberPingReplay] = setupEventReplaySubjects(
      [faberAgent],
      [DidCommTrustPingEventTypes.DidCommTrustPingReceivedEvent]
    )
    const ping = await aliceAgent.didcomm.connections.sendPing(existingConnection.id, { responseRequested: false })
    const pingReceived = await waitForTrustPingReceivedEventSubject(faberPingReplay, { threadId: ping.threadId })
    expect(pingReceived.thread?.parentThreadId).toBe(secondInvitation.outOfBandInvitation.id)
    expect(await faberAgent.didcomm.connections.getAll()).toHaveLength(1)
    expect((await faberAgent.didcomm.oob.getById(secondInvitation.id)).state).toBe(DidCommOutOfBandState.AwaitResponse)
  })

  test('v2 invitation with reuseConnection: an attached message is answered on the existing connection', async () => {
    const publicDid = await createInMemoryDid(faberAgent, 'rxjs:faber', { withKeyAgreement: true })
    const firstInvitation = await faberAgent.didcomm.oob.createInvitation({ didCommVersion: 'v2', ourDid: publicDid })
    const { connectionRecord: existingConnection } = await aliceAgent.didcomm.oob.receiveInvitation(
      firstInvitation.outOfBandInvitation,
      { label: 'alice' }
    )
    if (!existingConnection) throw new Error('Expected a connection')
    await aliceAgent.didcomm.basicMessages.sendMessage(existingConnection.id, 'before reuse')
    await waitForBasicMessageSubject(faberMessageReplay, { content: 'before reuse' })

    const attachedPing = new DidCommTrustPingV2Message({ responseRequested: true })
    const secondInvitation = await faberAgent.didcomm.oob.createInvitation({
      didCommVersion: 'v2',
      ourDid: publicDid,
      messages: [attachedPing],
    })
    const [faberPingReplay] = setupEventReplaySubjects(
      [faberAgent],
      [DidCommTrustPingEventTypes.DidCommTrustPingResponseReceivedEvent]
    )
    const { connectionRecord } = await aliceAgent.didcomm.oob.receiveInvitation(secondInvitation.outOfBandInvitation, {
      label: 'alice',
      reuseConnection: true,
    })
    expect(connectionRecord?.id).toBe(existingConnection.id)

    const reply = await waitForTrustPingResponseReceivedEventSubject(faberPingReplay, {
      threadId: attachedPing.threadId,
    })
    expect(reply.thread?.parentThreadId).toBe(secondInvitation.outOfBandInvitation.id)
    expect(await faberAgent.didcomm.connections.getAll()).toHaveLength(1)
  })

  test('v2 invitation with reuseConnection: a connection the inviter hung up is not reused', async () => {
    const publicDid = await createInMemoryDid(faberAgent, 'rxjs:faber', { withKeyAgreement: true })
    const firstInvitation = await faberAgent.didcomm.oob.createInvitation({ didCommVersion: 'v2', ourDid: publicDid })
    const { connectionRecord: hungUpConnection } = await aliceAgent.didcomm.oob.receiveInvitation(
      firstInvitation.outOfBandInvitation,
      { label: 'alice' }
    )
    if (!hungUpConnection) throw new Error('Expected a connection')
    await aliceAgent.didcomm.basicMessages.sendMessage(hungUpConnection.id, 'before the inviter hangs up')
    await waitForBasicMessageSubject(faberMessageReplay, { content: 'before the inviter hangs up' })
    const [faberConnection] = await faberAgent.didcomm.connections.findAllByOutOfBandId(firstInvitation.id)
    const [aliceRotateReplay] = setupEventReplaySubjects(
      [aliceAgent],
      [DidCommConnectionEventTypes.DidCommConnectionDidRotated]
    )
    await faberAgent.didcomm.connections.hangup({ connectionId: faberConnection.id })
    await waitForDidRotateSubject(aliceRotateReplay, {})

    const secondInvitation = await faberAgent.didcomm.oob.createInvitation({ didCommVersion: 'v2', ourDid: publicDid })
    const { connectionRecord } = await aliceAgent.didcomm.oob.receiveInvitation(secondInvitation.outOfBandInvitation, {
      label: 'alice',
      reuseConnection: true,
    })
    if (!connectionRecord) throw new Error('Expected a connection')
    expect(connectionRecord.id).not.toBe(hungUpConnection.id)

    await aliceAgent.didcomm.basicMessages.sendMessage(connectionRecord.id, 'after the inviter hung up')
    await waitForBasicMessageSubject(faberMessageReplay, { content: 'after the inviter hung up' })
    expect(await faberAgent.didcomm.connections.findAllByOutOfBandId(secondInvitation.id)).toHaveLength(1)
  })

  test('v2 invitation: the record loaded from storage still gives an out-of-band 2.0 invitation', async () => {
    const domain = 'https://example.com'
    const outOfBandRecord = await faberAgent.didcomm.oob.createInvitation({ didCommVersion: 'v2', goal: 'reload' })
    const storedRecord = await faberAgent.didcomm.oob.getById(outOfBandRecord.id)

    const invitationUrl = storedRecord.outOfBandInvitation.toUrl({ domain })
    expect(invitationUrl).toContain('?_oob=')
    expect(invitationUrl).toBe(outOfBandRecord.outOfBandInvitation.toUrl({ domain }))
  })

  test('v2 with handshakeProtocols throws', async () => {
    const inMemoryDid = await createInMemoryDid(faberAgent, 'rxjs:faber')

    await expect(
      aliceAgent.didcomm.oob.receiveImplicitInvitation({
        did: inMemoryDid,
        didCommVersion: 'v2',
        handshakeProtocols: [DidCommHandshakeProtocol.DidExchange],
        label: 'Alice',
      })
    ).rejects.toThrow(/handshakeProtocols cannot be used with DIDComm v2/)
  })

  test('omitted didCommVersion with dual-stack DID uses v2 from doc', async () => {
    const inMemoryDid = await createInMemoryDid(faberAgent, 'rxjs:faber')

    const { connectionRecord: aliceFaberConnection, outOfBandRecord } =
      await aliceAgent.didcomm.oob.receiveImplicitInvitation({
        did: inMemoryDid,
        alias: 'Faber public',
        label: 'Custom Alice',
      })

    expect(aliceFaberConnection).toBeDefined()
    expect(aliceFaberConnection?.state).toBe(DidCommDidExchangeState.Completed)
    expect(aliceFaberConnection?.didcommVersion).toBe('v2')
    expect(outOfBandRecord.outOfBandInvitation.v2Invitation?.from).toBe(inMemoryDid)
  })

  test(`make a connection with ${DidCommHandshakeProtocol.DidExchange} based on implicit OOB invitation`, async () => {
    const inMemoryDid = await createInMemoryDid(faberAgent, 'rxjs:faber')

    let { connectionRecord: aliceFaberConnection } = await aliceAgent.didcomm.oob.receiveImplicitInvitation({
      did: inMemoryDid,
      didCommVersion: 'v1',
      alias: 'Faber public',
      label: 'Custom Alice',
      handshakeProtocols: [DidCommHandshakeProtocol.DidExchange],
    })

    // Wait for a connection event in faber agent and accept the request
    let faberAliceConnection = await waitForConnectionRecordSubject(faberReplay, {
      threadId: aliceFaberConnection?.threadId,
      state: DidCommDidExchangeState.RequestReceived,
    })
    await faberAgent.didcomm.connections.acceptRequest(faberAliceConnection.id)
    faberAliceConnection = await faberAgent.didcomm.connections.returnWhenIsConnected(faberAliceConnection.id)
    expect(faberAliceConnection.state).toBe(DidCommDidExchangeState.Completed)

    // Alice should now be connected
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    aliceFaberConnection = await aliceAgent.didcomm.connections.returnWhenIsConnected(aliceFaberConnection?.id!)
    expect(aliceFaberConnection.state).toBe(DidCommDidExchangeState.Completed)

    expect(aliceFaberConnection).toBeConnectedWith(faberAliceConnection)
    expect(faberAliceConnection).toBeConnectedWith(aliceFaberConnection)
    expect(faberAliceConnection.theirLabel).toBe('Custom Alice')
    expect(aliceFaberConnection.theirLabel).toBe('Faber public')
    expect(aliceFaberConnection.invitationDid).toBe(inMemoryDid)

    // It is possible for an agent to check if it has already a connection to a certain public entity
    expect(await aliceAgent.didcomm.connections.findByInvitationDid(inMemoryDid)).toEqual([aliceFaberConnection])
  })

  test(`make a connection with ${DidCommHandshakeProtocol.DidExchange} based on implicit OOB invitation pointing to specific service`, async () => {
    const inMemoryDid = await createInMemoryDid(faberAgent, 'rxjs:faber')
    const inMemoryDidDocument = await faberAgent.dids.resolveDidDocument(inMemoryDid)
    const serviceUrl = inMemoryDidDocument.service?.[1].id

    let { connectionRecord: aliceFaberConnection } = await aliceAgent.didcomm.oob.receiveImplicitInvitation({
      // biome-ignore lint/style/noNonNullAssertion: no explanation
      did: serviceUrl!,
      didCommVersion: 'v1',
      alias: 'Faber public',
      label: 'alice',
      handshakeProtocols: [DidCommHandshakeProtocol.DidExchange],
    })

    // Wait for a connection event in faber agent and accept the request
    let faberAliceConnection = await waitForConnectionRecordSubject(faberReplay, {
      threadId: aliceFaberConnection?.threadId,
      state: DidCommDidExchangeState.RequestReceived,
    })
    await faberAgent.didcomm.connections.acceptRequest(faberAliceConnection.id)
    faberAliceConnection = await faberAgent.didcomm.connections.returnWhenIsConnected(faberAliceConnection?.id)
    expect(faberAliceConnection.state).toBe(DidCommDidExchangeState.Completed)

    // Alice should now be connected
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    aliceFaberConnection = await aliceAgent.didcomm.connections.returnWhenIsConnected(aliceFaberConnection?.id!)
    expect(aliceFaberConnection.state).toBe(DidCommDidExchangeState.Completed)

    expect(aliceFaberConnection).toBeConnectedWith(faberAliceConnection)
    expect(faberAliceConnection).toBeConnectedWith(aliceFaberConnection)
    expect(faberAliceConnection.theirLabel).toBe('alice')
    expect(aliceFaberConnection.theirLabel).toBe('Faber public')
    expect(aliceFaberConnection.invitationDid).toBe(serviceUrl)

    // It is possible for an agent to check if it has already a connection to a certain public entity
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    expect(await aliceAgent.didcomm.connections.findByInvitationDid(serviceUrl!)).toEqual([aliceFaberConnection])
  })

  test('receive an implicit invitation using an unresolvable did', async () => {
    await expect(
      aliceAgent.didcomm.oob.receiveImplicitInvitation({
        did: 'did:sov:ZSEqSci581BDZCFPa29ScB',
        didCommVersion: 'v1',
        label: 'alice',
        alias: 'Faber public',
        handshakeProtocols: [DidCommHandshakeProtocol.DidExchange],
      })
    ).rejects.toThrow(/Unable to resolve|No DIDComm/)
  })

  test('create two connections using the same implicit invitation', async () => {
    const inMemoryDid = await createInMemoryDid(faberAgent, 'rxjs:faber')

    let { connectionRecord: aliceFaberConnection } = await aliceAgent.didcomm.oob.receiveImplicitInvitation({
      did: inMemoryDid,
      didCommVersion: 'v1',
      label: 'alice',
      alias: 'Faber public',
      handshakeProtocols: [DidCommHandshakeProtocol.DidExchange],
    })

    // Wait for a connection event in faber agent and accept the request
    let faberAliceConnection = await waitForConnectionRecordSubject(faberReplay, {
      threadId: aliceFaberConnection?.threadId,
      state: DidCommDidExchangeState.RequestReceived,
    })
    await faberAgent.didcomm.connections.acceptRequest(faberAliceConnection.id)
    faberAliceConnection = await faberAgent.didcomm.connections.returnWhenIsConnected(faberAliceConnection?.id)
    expect(faberAliceConnection.state).toBe(DidCommDidExchangeState.Completed)

    // Alice should now be connected
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    aliceFaberConnection = await aliceAgent.didcomm.connections.returnWhenIsConnected(aliceFaberConnection?.id!)
    expect(aliceFaberConnection.state).toBe(DidCommDidExchangeState.Completed)

    expect(aliceFaberConnection).toBeConnectedWith(faberAliceConnection)
    expect(faberAliceConnection).toBeConnectedWith(aliceFaberConnection)
    expect(faberAliceConnection.theirLabel).toBe('alice')
    expect(aliceFaberConnection.theirLabel).toBe('Faber public')
    expect(aliceFaberConnection.invitationDid).toBe(inMemoryDid)

    // Repeat implicit invitation procedure
    let { connectionRecord: aliceFaberNewConnection } = await aliceAgent.didcomm.oob.receiveImplicitInvitation({
      did: inMemoryDid,
      didCommVersion: 'v1',
      alias: 'Faber public New',
      label: 'Alice New',
      handshakeProtocols: [DidCommHandshakeProtocol.DidExchange],
    })

    // Wait for a connection event in faber agent
    let faberAliceNewConnection = await waitForConnectionRecordSubject(faberReplay, {
      threadId: aliceFaberNewConnection?.threadId,
      state: DidCommDidExchangeState.RequestReceived,
    })
    await faberAgent.didcomm.connections.acceptRequest(faberAliceNewConnection.id)
    faberAliceNewConnection = await faberAgent.didcomm.connections.returnWhenIsConnected(faberAliceNewConnection?.id)
    expect(faberAliceNewConnection.state).toBe(DidCommDidExchangeState.Completed)

    // Alice should now be connected
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    aliceFaberNewConnection = await aliceAgent.didcomm.connections.returnWhenIsConnected(aliceFaberNewConnection?.id!)
    expect(aliceFaberNewConnection.state).toBe(DidCommDidExchangeState.Completed)

    expect(aliceFaberNewConnection).toBeConnectedWith(faberAliceNewConnection)
    expect(faberAliceNewConnection).toBeConnectedWith(aliceFaberNewConnection)
    expect(faberAliceNewConnection.theirLabel).toBe('Alice New')
    expect(aliceFaberNewConnection.theirLabel).toBe('Faber public New')
    expect(aliceFaberNewConnection.invitationDid).toBe(inMemoryDid)

    // Both connections will be associated to the same invitation did
    const connectionsFromFaberPublicDid = await aliceAgent.didcomm.connections.findByInvitationDid(inMemoryDid)
    expect(connectionsFromFaberPublicDid).toHaveLength(2)
    expect(connectionsFromFaberPublicDid).toEqual(
      expect.arrayContaining([aliceFaberConnection, aliceFaberNewConnection])
    )
  })
})

async function createInMemoryDid(agent: Agent, endpoint: string, { withKeyAgreement = false } = {}) {
  const ed25519Key = await agent.kms.createKey({
    type: {
      kty: 'OKP',
      crv: 'Ed25519',
    },
  })
  const publicJwk = Kms.PublicJwk.fromPublicJwk(ed25519Key.publicJwk)

  const did = `did:inmemory:${publicJwk.fingerprint}`
  const builder = new DidDocumentBuilder(did)
  const ed25519VerificationMethod = getEd25519VerificationKey2018({
    publicJwk,
    id: `${did}#${publicJwk.fingerprint}`,
    controller: did,
  })

  builder.addService(
    new DidDocumentService({
      id: `${did}#endpoint`,
      serviceEndpoint: endpoint,
      type: 'endpoint',
    })
  )
  builder.addService(
    new DidCommV1Service({
      id: `${did}#did-communication`,
      priority: 0,
      recipientKeys: [ed25519VerificationMethod.id],
      routingKeys: [],
      serviceEndpoint: endpoint,
      accept: ['didcomm/aip2;env=rfc19'],
    })
  )

  builder.addService(
    new NewDidCommV2Service({
      id: `${did}#didcomm-messaging-1`,
      serviceEndpoint: new NewDidCommV2ServiceEndpoint({
        accept: ['didcomm/v2'],
        routingKeys: [],
        uri: endpoint,
      }),
    })
  )

  builder.addVerificationMethod(ed25519VerificationMethod)
  builder.addAuthentication(ed25519VerificationMethod.id)
  builder.addAssertionMethod(ed25519VerificationMethod.id)
  if (withKeyAgreement) {
    builder.addKeyAgreement(
      getX25519KeyAgreementKey2019({
        id: `${did}#key-agreement-1`,
        controller: did,
        publicJwk: Kms.PublicJwk.fromPublicKey({
          kty: 'OKP',
          crv: 'X25519',
          publicKey: convertPublicKeyToX25519(publicJwk.publicKey.publicKey),
        }),
      })
    )
  }

  // Create the did:inmemory did
  const {
    didState: { state },
  } = await agent.dids.create({
    did,
    didDocument: builder.build(),
    options: {
      keys: [
        {
          didDocumentRelativeKeyId: `#${publicJwk.fingerprint}`,
          kmsKeyId: ed25519Key.keyId,
        } satisfies DidDocumentKey,
        ...(withKeyAgreement
          ? [{ didDocumentRelativeKeyId: '#key-agreement-1', kmsKeyId: ed25519Key.keyId } satisfies DidDocumentKey]
          : []),
      ],
    },
  })

  if (state !== 'finished') {
    throw new Error('Error creating DID')
  }

  return did
}
