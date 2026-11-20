import { Agent } from '../../../../../core/src/agent/Agent'
import { getDidPeer4ShortFormForEquivalence } from '../../../../../core/src/modules/dids/methods/peer/peerDidNumAlgo4'
import { type EventReplaySubject, setupEventReplaySubjects, setupSubjectTransports } from '../../../../../core/tests'
import {
  getAgentOptions,
  makeConnection,
  waitForAgentMessageProcessedEventSubject,
  waitForBasicMessageSubject,
} from '../../../../../core/tests/helpers'
import { DidCommEventTypes } from '../../../DidCommEvents'
import { DidCommBasicMessageEventTypes } from '../../basic-messages'
import { DidCommDidRotateAckMessage } from '../messages'
import { DidCommHandshakeProtocol } from '../models'
import { DidCommConnectionRepository } from '../repository'
import { createPeerDidForV2OOB } from '../services/helpers'

const agentOptions = (name: string) =>
  getAgentOptions(
    `Delete Associated Keys ${name}`,
    {
      didcommVersions: ['v1', 'v2'],
      endpoints: [`rxjs:delete-keys-${name}`],
      connections: { autoAcceptConnections: true, autoCreateConnectionOnFirstMessage: true },
    },
    undefined,
    undefined,
    { requireDidcomm: true }
  )

const faberAgentOptions = agentOptions('faber')
const aliceAgentOptions = agentOptions('alice')
const acmeAgentOptions = agentOptions('acme')

describe('deleteById with deleteAssociatedKeys', () => {
  let faber: Agent<(typeof faberAgentOptions)['modules']>
  let alice: Agent<(typeof aliceAgentOptions)['modules']>
  let acme: Agent<(typeof acmeAgentOptions)['modules']>
  let faberReplay: EventReplaySubject

  beforeEach(async () => {
    faber = new Agent(faberAgentOptions)
    alice = new Agent(aliceAgentOptions)
    acme = new Agent(acmeAgentOptions)
    setupSubjectTransports([faber, alice, acme])
    await faber.initialize()
    await alice.initialize()
    await acme.initialize()
    ;[faberReplay] = setupEventReplaySubjects(
      [faber],
      [DidCommBasicMessageEventTypes.DidCommBasicMessageV2StateChanged]
    )
  })

  afterEach(async () => {
    await faber.shutdown()
    await alice.shutdown()
    await acme.shutdown()
  })

  const keyExists = (agent: Agent, keyId: string) =>
    agent.kms.getPublicKey({ keyId }).then(
      () => true,
      () => false
    )

  const didKeyIds = async (agent: Agent, did: string) => {
    const [didRecord] = await agent.dids.getCreatedDids({ did })
    return didRecord?.keys?.map(({ kmsKeyId }) => kmsKeyId) ?? []
  }

  test('keeps the DID and keys when the option is not set', async () => {
    const [, aliceConnection] = await makeConnection(faber, alice)
    const keyIds = await didKeyIds(alice, aliceConnection.did as string)

    await alice.didcomm.connections.deleteById(aliceConnection.id)

    expect(await didKeyIds(alice, aliceConnection.did as string)).toEqual(keyIds)
    expect(await keyExists(alice, keyIds[0])).toBe(true)
  })

  test('deletes the DID and keys of a connection', async () => {
    const [, aliceConnection] = await makeConnection(faber, alice)
    const [keyId] = await didKeyIds(alice, aliceConnection.did as string)

    await alice.didcomm.connections.deleteById(aliceConnection.id, { deleteAssociatedKeys: true })

    expect(await alice.dids.getCreatedDids({ did: aliceConnection.did })).toHaveLength(0)
    expect(await keyExists(alice, keyId)).toBe(false)
  })

  test('deletes the DID and keys of a connection on hangup', async () => {
    const [, aliceConnection] = await makeConnection(faber, alice)
    const [keyId] = await didKeyIds(alice, aliceConnection.did as string)

    await expect(
      alice.didcomm.connections.hangup({ connectionId: aliceConnection.id, deleteAssociatedKeys: true })
    ).rejects.toThrow("'deleteAssociatedKeys' requires 'deleteAfterHangup'")

    await alice.didcomm.connections.hangup({
      connectionId: aliceConnection.id,
      deleteAfterHangup: true,
      deleteAssociatedKeys: true,
    })

    expect(await alice.dids.getCreatedDids({ did: aliceConnection.did })).toHaveLength(0)
    expect(await keyExists(alice, keyId)).toBe(false)
  })

  test('deletes the DIDs and keys of a connection that rotated its DID', async () => {
    const [, aliceConnection] = await makeConnection(faber, alice)
    const oldDid = aliceConnection.did as string
    const oldKeyIds = await didKeyIds(alice, oldDid)

    const [aliceReplay] = setupEventReplaySubjects([alice], [DidCommEventTypes.DidCommMessageProcessed])
    const { newDid } = await alice.didcomm.connections.rotate({ connectionId: aliceConnection.id })
    await waitForAgentMessageProcessedEventSubject(aliceReplay, {
      messageType: DidCommDidRotateAckMessage.type.messageTypeUri,
    })
    expect((await alice.didcomm.connections.getById(aliceConnection.id)).previousDids).toEqual([oldDid])
    const newKeyIds = await didKeyIds(alice, newDid)

    await alice.didcomm.connections.deleteById(aliceConnection.id, { deleteAssociatedKeys: true })

    expect(await alice.dids.getCreatedDids({ did: oldDid })).toHaveLength(0)
    expect(await alice.dids.getCreatedDids({ did: newDid })).toHaveLength(0)
    for (const keyId of [...oldKeyIds, ...newKeyIds]) expect(await keyExists(alice, keyId)).toBe(false)
  })

  test('deletes the DIDs and keys of a v2 connection that rotated its DID', async () => {
    const outOfBandRecord = await faber.didcomm.oob.createInvitation({ didCommVersion: 'v2' })
    const { connectionRecord } = await alice.didcomm.oob.receiveInvitation(outOfBandRecord.outOfBandInvitation, {
      label: '',
    })
    const aliceConnection = connectionRecord as NonNullable<typeof connectionRecord>
    const oldDid = aliceConnection.did as string
    const oldKeyIds = await didKeyIds(alice, oldDid)

    const { newDid } = await alice.didcomm.connections.rotate({ connectionId: aliceConnection.id })
    const newKeyIds = await didKeyIds(alice, newDid)
    expect(newKeyIds.length).toBeGreaterThan(0)

    await alice.didcomm.connections.deleteById(aliceConnection.id, { deleteAssociatedKeys: true })

    expect(await alice.dids.getCreatedDids({ did: oldDid })).toHaveLength(0)
    expect(await alice.dids.getCreatedDids({ did: newDid })).toHaveLength(0)
    for (const keyId of [...oldKeyIds, ...newKeyIds]) expect(await keyExists(alice, keyId)).toBe(false)
  })

  test('keeps the key a single-use invitation passed on until both records are deleted', async () => {
    const [faberConnection] = await makeConnection(faber, alice)
    const outOfBandRecord = await faber.didcomm.oob.getById(faberConnection.outOfBandId as string)
    const [{ kmsKeyId }] = outOfBandRecord.invitationInlineServiceKeys ?? []
    expect(await didKeyIds(faber, faberConnection.did as string)).toContain(kmsKeyId)

    await faber.didcomm.oob.deleteById(outOfBandRecord.id, { deleteAssociatedKeys: true })
    expect(await keyExists(faber, kmsKeyId)).toBe(true)

    await faber.didcomm.connections.deleteById(faberConnection.id, { deleteAssociatedKeys: true })
    expect(await faber.dids.getCreatedDids({ did: faberConnection.did })).toHaveLength(0)
    expect(await keyExists(faber, kmsKeyId)).toBe(false)
  })

  test('keeps the key a single-use invitation passed on while the invitation exists', async () => {
    const [faberConnection] = await makeConnection(faber, alice)
    const outOfBandRecord = await faber.didcomm.oob.getById(faberConnection.outOfBandId as string)
    const [{ kmsKeyId }] = outOfBandRecord.invitationInlineServiceKeys ?? []

    await faber.didcomm.connections.deleteById(faberConnection.id, { deleteAssociatedKeys: true })
    expect(await faber.dids.getCreatedDids({ did: faberConnection.did })).toHaveLength(0)
    expect(await keyExists(faber, kmsKeyId)).toBe(true)

    await faber.didcomm.oob.deleteById(outOfBandRecord.id, { deleteAssociatedKeys: true })
    expect(await keyExists(faber, kmsKeyId)).toBe(false)
  })

  test('keeps the key of a reusable invitation when deleting one of its connections', async () => {
    const outOfBandRecord = await faber.didcomm.oob.createInvitation({
      multiUseInvitation: true,
      handshakeProtocols: [DidCommHandshakeProtocol.DidExchange],
    })
    const [{ kmsKeyId: invitationKeyId }] = outOfBandRecord.invitationInlineServiceKeys ?? []

    for (const agent of [alice, acme]) {
      const { connectionRecord } = await agent.didcomm.oob.receiveInvitation(outOfBandRecord.outOfBandInvitation, {
        label: '',
      })
      await agent.didcomm.connections.returnWhenIsConnected(connectionRecord?.id as string)
    }
    const [first, second] = await Promise.all(
      (await faber.didcomm.connections.findAllByOutOfBandId(outOfBandRecord.id)).map(({ id }) =>
        faber.didcomm.connections.returnWhenIsConnected(id)
      )
    )
    const [firstKeyId] = await didKeyIds(faber, first.did as string)
    const [secondKeyId] = await didKeyIds(faber, second.did as string)

    await faber.didcomm.connections.deleteById(first.id, { deleteAssociatedKeys: true })
    expect(await keyExists(faber, firstKeyId)).toBe(false)
    expect(await keyExists(faber, invitationKeyId)).toBe(true)

    await faber.didcomm.oob.deleteById(outOfBandRecord.id, { deleteAssociatedKeys: true })
    expect(await keyExists(faber, invitationKeyId)).toBe(false)
    expect(await keyExists(faber, secondKeyId)).toBe(true)
  })

  test('keeps the keys of routing passed to createInvitation', async () => {
    const routing = await faber.didcomm.mediationRecipient.getRouting({})
    const outOfBandRecord = await faber.didcomm.oob.createInvitation({ routing })

    await faber.didcomm.oob.deleteById(outOfBandRecord.id, { deleteAssociatedKeys: true })

    expect(await keyExists(faber, routing.recipientKey.keyId)).toBe(true)
  })

  test('deletes the keys of routing passed to createInvitation with deleteWithRecord', async () => {
    const routing = await faber.didcomm.mediationRecipient.getRouting({})
    const outOfBandRecord = await faber.didcomm.oob.createInvitation({
      routing: { ...routing, deleteWithRecord: true },
    })

    await faber.didcomm.oob.deleteById(outOfBandRecord.id, { deleteAssociatedKeys: true })

    expect(await keyExists(faber, routing.recipientKey.keyId)).toBe(false)
  })

  test('deletes the keys of routing passed to receiveInvitation with deleteWithRecord', async () => {
    const outOfBandRecord = await faber.didcomm.oob.createInvitation({
      handshakeProtocols: [DidCommHandshakeProtocol.DidExchange],
    })
    const routing = await alice.didcomm.mediationRecipient.getRouting({})
    const { connectionRecord } = await alice.didcomm.oob.receiveInvitation(outOfBandRecord.outOfBandInvitation, {
      label: '',
      routing: { ...routing, deleteWithRecord: true },
    })

    await alice.didcomm.connections.deleteById(connectionRecord?.id as string, { deleteAssociatedKeys: true })

    expect(await keyExists(alice, routing.recipientKey.keyId)).toBe(false)
  })

  test('deletes the keys of routing passed to receiveInvitation with deleteWithRecord when accepting later', async () => {
    const outOfBandRecord = await faber.didcomm.oob.createInvitation({
      handshakeProtocols: [DidCommHandshakeProtocol.DidExchange],
    })
    const routing = await alice.didcomm.mediationRecipient.getRouting({})
    const { outOfBandRecord: aliceOutOfBandRecord } = await alice.didcomm.oob.receiveInvitation(
      outOfBandRecord.outOfBandInvitation,
      { label: '', routing: { ...routing, deleteWithRecord: true }, autoAcceptInvitation: false }
    )
    const { connectionRecord } = await alice.didcomm.oob.acceptInvitation(aliceOutOfBandRecord.id, { label: '' })

    await alice.didcomm.connections.deleteById(connectionRecord?.id as string, { deleteAssociatedKeys: true })
    expect(await keyExists(alice, routing.recipientKey.keyId)).toBe(true)

    await alice.didcomm.oob.deleteById(aliceOutOfBandRecord.id, { deleteAssociatedKeys: true })
    expect(await keyExists(alice, routing.recipientKey.keyId)).toBe(false)
  })

  test('creates no keys for a v2 invitation with ourDid and keeps that DID', async () => {
    const { did } = await createPeerDidForV2OOB(faber.context, await faber.didcomm.mediationRecipient.getRouting({}))
    const keyIds = await didKeyIds(faber, did)

    const createKeySpy = vi.spyOn(faber.kms, 'createKey')
    const outOfBandRecord = await faber.didcomm.oob.createInvitation({ didCommVersion: 'v2', ourDid: did })
    expect(createKeySpy).not.toHaveBeenCalled()
    createKeySpy.mockRestore()

    await faber.didcomm.oob.deleteById(outOfBandRecord.id, { deleteAssociatedKeys: true })
    expect(await didKeyIds(faber, did)).toEqual(keyIds)
    for (const keyId of keyIds) expect(await keyExists(faber, keyId)).toBe(true)
  })

  test('keeps a DID that another invitation or connection got as ourDid', async () => {
    // Faber's second invitation gets the DID of its connection, and Alice's connection the DID of her invitation
    const [faberConnection, aliceConnection] = await makeConnection(faber, alice, { didCommVersion: 'v2' })
    const faberDid = faberConnection.did as string
    const aliceDid = aliceConnection.did as string
    const faberKeyIds = await didKeyIds(faber, faberDid)
    const aliceKeyIds = await didKeyIds(alice, aliceDid)

    await faber.didcomm.connections.deleteById(faberConnection.id, { deleteAssociatedKeys: true })
    expect(await didKeyIds(faber, faberDid)).toEqual(faberKeyIds)
    for (const keyId of faberKeyIds) expect(await keyExists(faber, keyId)).toBe(true)

    const aliceInvitation = (await alice.didcomm.oob.getAll()).find(
      (record) => record.outOfBandInvitation.v2Invitation?.from === aliceDid
    )
    await alice.didcomm.oob.deleteById(aliceInvitation?.id as string, { deleteAssociatedKeys: true })
    expect(await didKeyIds(alice, aliceDid)).toEqual(aliceKeyIds)
    for (const keyId of aliceKeyIds) expect(await keyExists(alice, keyId)).toBe(true)
  })

  test('keeps a DID that a v1 invitation got as invitationDid', async () => {
    const [, aliceConnection] = await makeConnection(faber, alice)
    const did = aliceConnection.did as string
    const keyIds = await didKeyIds(alice, did)
    await alice.didcomm.oob.createInvitation({ didCommVersion: 'v1', invitationDid: did })

    await alice.didcomm.connections.deleteById(aliceConnection.id, { deleteAssociatedKeys: true })
    expect(await didKeyIds(alice, did)).toEqual(keyIds)
    for (const keyId of keyIds) expect(await keyExists(alice, keyId)).toBe(true)
  })

  test('keeps the DID of a reusable v2 invitation until the invitation and its connections are deleted', async () => {
    const outOfBandRecord = await faber.didcomm.oob.createInvitation({ didCommVersion: 'v2', multiUseInvitation: true })
    const invitationDid = outOfBandRecord.outOfBandInvitation.v2Invitation?.from as string
    const invitationKeyIds = await didKeyIds(faber, invitationDid)

    const { connectionRecord: aliceConnection } = await alice.didcomm.oob.receiveInvitation(
      outOfBandRecord.outOfBandInvitation,
      { label: '' }
    )
    await alice.didcomm.basicMessages.sendMessage(aliceConnection?.id as string, 'hello')
    await waitForBasicMessageSubject(faberReplay, { content: 'hello' })
    const [faberConnection] = await faber.didcomm.connections.findAllByOutOfBandId(outOfBandRecord.id)
    expect(faberConnection.previousDids).toEqual([invitationDid])
    const rotatedKeyIds = await didKeyIds(faber, faberConnection.did as string)

    await faber.didcomm.oob.deleteById(outOfBandRecord.id, { deleteAssociatedKeys: true })
    expect(await didKeyIds(faber, invitationDid)).toEqual(invitationKeyIds)

    await faber.didcomm.connections.deleteById(faberConnection.id, { deleteAssociatedKeys: true })
    expect(await faber.dids.getCreatedDids({ did: invitationDid })).toHaveLength(0)
    for (const keyId of [...invitationKeyIds, ...rotatedKeyIds]) expect(await keyExists(faber, keyId)).toBe(false)
  })

  test('keeps the DID of a deleted reusable v2 invitation while another of its connections uses it', async () => {
    const outOfBandRecord = await faber.didcomm.oob.createInvitation({ didCommVersion: 'v2', multiUseInvitation: true })
    const invitationDid = outOfBandRecord.outOfBandInvitation.v2Invitation?.from as string
    const invitationKeyIds = await didKeyIds(faber, invitationDid)

    for (const [agent, content] of [
      [alice, 'hello from alice'],
      [acme, 'hello from acme'],
    ] as const) {
      const { connectionRecord } = await agent.didcomm.oob.receiveInvitation(outOfBandRecord.outOfBandInvitation, {
        label: '',
      })
      await agent.didcomm.basicMessages.sendMessage(connectionRecord?.id as string, content)
      await waitForBasicMessageSubject(faberReplay, { content })
    }
    const [first, second] = await faber.didcomm.connections.findAllByOutOfBandId(outOfBandRecord.id)
    expect(second.previousDids).toEqual([invitationDid])

    await faber.didcomm.oob.deleteById(outOfBandRecord.id, { deleteAssociatedKeys: true })
    await faber.didcomm.connections.deleteById(first.id, { deleteAssociatedKeys: true })
    expect(await didKeyIds(faber, invitationDid)).toEqual(invitationKeyIds)
    for (const keyId of invitationKeyIds) expect(await keyExists(faber, keyId)).toBe(true)

    await faber.didcomm.connections.deleteById(second.id, { deleteAssociatedKeys: true })
    expect(await faber.dids.getCreatedDids({ did: invitationDid })).toHaveLength(0)
    for (const keyId of invitationKeyIds) expect(await keyExists(faber, keyId)).toBe(false)
  })

  test('keeps the DID of a single-use v2 invitation until both records are deleted', async () => {
    const outOfBandRecord = await faber.didcomm.oob.createInvitation({ didCommVersion: 'v2' })
    const invitationDid = outOfBandRecord.outOfBandInvitation.v2Invitation?.from as string
    const invitationKeyIds = await didKeyIds(faber, invitationDid)

    const { connectionRecord: aliceConnection } = await alice.didcomm.oob.receiveInvitation(
      outOfBandRecord.outOfBandInvitation,
      { label: '' }
    )
    await alice.didcomm.basicMessages.sendMessage(aliceConnection?.id as string, 'hello')
    await waitForBasicMessageSubject(faberReplay, { content: 'hello' })
    const [faberConnection] = await faber.didcomm.connections.findAllByOutOfBandId(outOfBandRecord.id)
    expect(faberConnection.did).toEqual(invitationDid)

    await faber.didcomm.oob.deleteById(outOfBandRecord.id, { deleteAssociatedKeys: true })
    expect(await didKeyIds(faber, invitationDid)).toEqual(invitationKeyIds)

    await faber.didcomm.connections.deleteById(faberConnection.id, { deleteAssociatedKeys: true })
    expect(await faber.dids.getCreatedDids({ did: invitationDid })).toHaveLength(0)
    for (const keyId of invitationKeyIds) expect(await keyExists(faber, keyId)).toBe(false)

    // The accepting side created its DID for the connection
    const aliceKeyIds = await didKeyIds(alice, aliceConnection?.did as string)
    await alice.didcomm.connections.deleteById(aliceConnection?.id as string, { deleteAssociatedKeys: true })
    for (const keyId of aliceKeyIds) expect(await keyExists(alice, keyId)).toBe(false)
  })

  test('keeps the DID of a single-use v2 invitation that the connection uses in its short form', async () => {
    const outOfBandRecord = await faber.didcomm.oob.createInvitation({ didCommVersion: 'v2' })
    const invitationDid = outOfBandRecord.outOfBandInvitation.v2Invitation?.from as string
    const invitationKeyIds = await didKeyIds(faber, invitationDid)

    const { connectionRecord: aliceConnection } = await alice.didcomm.oob.receiveInvitation(
      outOfBandRecord.outOfBandInvitation,
      { label: '' }
    )
    await alice.didcomm.basicMessages.sendMessage(aliceConnection?.id as string, 'hello')
    await waitForBasicMessageSubject(faberReplay, { content: 'hello' })
    const [faberConnection] = await faber.didcomm.connections.findAllByOutOfBandId(outOfBandRecord.id)

    // A peer that addresses the short form of the did:peer:4 leaves that form on the connection
    const shortFormDid = getDidPeer4ShortFormForEquivalence(invitationDid) as string
    expect(shortFormDid).not.toEqual(invitationDid)
    faberConnection.did = shortFormDid
    await faber.context.resolve(DidCommConnectionRepository).update(faber.context, faberConnection)

    await faber.didcomm.oob.deleteById(outOfBandRecord.id, { deleteAssociatedKeys: true })
    expect(await didKeyIds(faber, invitationDid)).toEqual(invitationKeyIds)

    await faber.didcomm.connections.deleteById(faberConnection.id, { deleteAssociatedKeys: true })
    expect(await faber.dids.getCreatedDids({ did: invitationDid })).toHaveLength(0)
    for (const keyId of invitationKeyIds) expect(await keyExists(faber, keyId)).toBe(false)
  })
})
