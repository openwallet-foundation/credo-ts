import { Agent } from '../../../../../core/src/agent/Agent'
import { DidDeactivatedError } from '../../../../../core/src/modules/dids'
import { setupSubjectTransports } from '../../../../../core/tests'
import { getAgentOptions, makeConnection } from '../../../../../core/tests/helpers'
import { DidCommDocumentService } from '../../../services'
import { createPeerDidForV2OOB } from '../services/helpers'

const agentOptions = (name: string) =>
  getAgentOptions(
    `Deactivated DID ${name}`,
    {
      didcommVersions: ['v1', 'v2'],
      endpoints: [`rxjs:deactivated-did-${name}`],
      connections: { autoAcceptConnections: true },
    },
    undefined,
    undefined,
    { requireDidcomm: true }
  )

const faberAgentOptions = agentOptions('faber')
const aliceAgentOptions = agentOptions('alice')

describe('deactivated DID in DIDComm', () => {
  let faber: Agent<(typeof faberAgentOptions)['modules']>
  let alice: Agent<(typeof aliceAgentOptions)['modules']>

  beforeEach(async () => {
    faber = new Agent(faberAgentOptions)
    alice = new Agent(aliceAgentOptions)
    setupSubjectTransports([faber, alice])
    await faber.initialize()
    await alice.initialize()
  })

  afterEach(async () => {
    await faber.shutdown()
    await alice.shutdown()
  })

  test('a connection whose DID is deactivated no longer sends or decrypts', async () => {
    const [, aliceConnection] = await makeConnection(faber, alice)
    const did = aliceConnection.did as string
    await alice.dids.deactivate({ did })

    await expect(alice.didcomm.basicMessages.sendMessage(aliceConnection.id, 'hello')).rejects.toMatchObject({
      cause: expect.any(DidDeactivatedError),
    })

    const [{ publicJwk }] = (await alice.dids.resolveDidDocument(did)).getRecipientKeysWithVerificationMethod({
      mapX25519ToEd25519: false,
    })
    await expect(
      alice.dependencyManager
        .resolve(DidCommDocumentService)
        .resolveCreatedDidDocumentWithKeysByRecipientKey(alice.context, publicJwk)
    ).rejects.toThrow(DidDeactivatedError)
  })

  test('a deactivated DID is not used for a v1 invitation', async () => {
    const [, aliceConnection] = await makeConnection(faber, alice)
    const did = aliceConnection.did as string
    await alice.dids.deactivate({ did })

    await expect(alice.didcomm.oob.createInvitation({ didCommVersion: 'v1', invitationDid: did })).rejects.toThrow(
      DidDeactivatedError
    )
  })

  test('a deactivated DID is not used to accept a v2 invitation', async () => {
    const { did } = await createPeerDidForV2OOB(alice.context, await alice.didcomm.mediationRecipient.getRouting({}))
    await alice.dids.deactivate({ did })
    const outOfBandRecord = await faber.didcomm.oob.createInvitation({ didCommVersion: 'v2' })

    await expect(
      alice.didcomm.oob.receiveInvitation(outOfBandRecord.outOfBandInvitation, { label: '', ourDid: did })
    ).rejects.toThrow(DidDeactivatedError)
  })
})
