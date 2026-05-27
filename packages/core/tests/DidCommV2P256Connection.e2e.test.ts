import { Agent } from '../src/agent/Agent'
import { getAgentOptions } from './helpers'
import { setupSubjectTransports } from './transport'

const faberAgent = new Agent(
  getAgentOptions(
    'Faber Agent DIDComm v2 P-256',
    {
      endpoints: ['rxjs:faber-p256'],
      didcommVersions: ['v1', 'v2'],
      v2KeyAgreementCurve: 'P-256',
      connections: { autoAcceptConnections: true, autoCreateConnectionOnFirstMessage: true },
    },
    undefined,
    undefined,
    { requireDidcomm: true }
  )
)

const aliceAgent = new Agent(
  getAgentOptions(
    'Alice Agent DIDComm v2 P-256',
    {
      endpoints: ['rxjs:alice-p256'],
      didcommVersions: ['v1', 'v2'],
      v2KeyAgreementCurve: 'P-256',
      connections: { autoAcceptConnections: true, autoCreateConnectionOnFirstMessage: true },
    },
    undefined,
    undefined,
    { requireDidcomm: true }
  )
)

describe('DIDComm v2 P-256 connection', () => {
  beforeEach(async () => {
    setupSubjectTransports([faberAgent, aliceAgent])
    await faberAgent.initialize()
    await aliceAgent.initialize()
  })

  afterEach(async () => {
    await faberAgent.shutdown()
    await aliceAgent.shutdown()
  })

  it('establishes a bidirectional v2 OOB connection with P-256 keyAgreement', async () => {
    const invAlice = await aliceAgent.didcomm.oob.createInvitation({ didCommVersion: 'v2' })
    const aliceDid = invAlice.outOfBandInvitation.v2Invitation?.from as string
    const { connectionRecord: faberConn0, outOfBandRecord: faberOob0 } = await faberAgent.didcomm.oob.receiveInvitation(
      invAlice.outOfBandInvitation,
      { label: '' }
    )
    const faberConnId =
      faberConn0?.id ?? (await faberAgent.didcomm.connections.findAllByOutOfBandId(faberOob0.id))[0]?.id
    const faberConnection = await faberAgent.didcomm.connections.returnWhenIsConnected(faberConnId as string, {
      timeoutMs: 20000,
    })

    const invFaber = await faberAgent.didcomm.oob.createInvitation({
      didCommVersion: 'v2',
      ourDid: faberConnection.did,
    })
    const { connectionRecord: aliceConn0, outOfBandRecord: aliceOob0 } = await aliceAgent.didcomm.oob.receiveInvitation(
      invFaber.outOfBandInvitation,
      { label: '', ourDid: aliceDid }
    )
    const aliceConnId =
      aliceConn0?.id ?? (await aliceAgent.didcomm.connections.findAllByOutOfBandId(aliceOob0.id))[0]?.id
    const aliceConnection = await aliceAgent.didcomm.connections.returnWhenIsConnected(aliceConnId as string, {
      timeoutMs: 20000,
    })

    expect(faberConnection.did).toBeDefined()
    expect(aliceConnection.did).toBeDefined()
    expect(faberConnection.theirDid).toBe(aliceDid)
    expect(aliceConnection.theirDid).toBe(faberConnection.did)
  }, 30000)
})
