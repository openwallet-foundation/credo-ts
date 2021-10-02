import type { SubjectMessage } from '../../../tests/transport/SubjectInboundTransport'

import { Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../tests/transport/SubjectOutboundTransport'
import { ConnectionState } from '../src'
import { Agent } from '../src/agent/Agent'

import { getBaseConfig } from './helpers'

const faberConfig = getBaseConfig('Faber Agent Connections', {
  endpoints: ['rxjs:faber'],
})
const aliceConfig = getBaseConfig('Alice Agent Connections', {
  endpoints: ['rxjs:alice'],
})

describe('connections', () => {
  let faberAgent: Agent
  let aliceAgent: Agent

  beforeAll(async () => {
    const faberMessages = new Subject<SubjectMessage>()
    const aliceMessages = new Subject<SubjectMessage>()
    const subjectMap = {
      'rxjs:faber': faberMessages,
      'rxjs:alice': aliceMessages,
    }

    faberAgent = new Agent(faberConfig.config, faberConfig.agentDependencies)
    faberAgent.registerInboundTransport(new SubjectInboundTransport(faberMessages))
    faberAgent.registerOutboundTransport(new SubjectOutboundTransport(aliceMessages, subjectMap))
    await faberAgent.initialize()

    aliceAgent = new Agent(aliceConfig.config, aliceConfig.agentDependencies)
    aliceAgent.registerInboundTransport(new SubjectInboundTransport(aliceMessages))
    aliceAgent.registerOutboundTransport(new SubjectOutboundTransport(faberMessages, subjectMap))
    await aliceAgent.initialize()
  })

  afterAll(async () => {
    await faberAgent.shutdown({
      deleteWallet: true,
    })
    await aliceAgent.shutdown({
      deleteWallet: true,
    })
  })

  it('should be able to make multiple connections using a multi use invite', async () => {
    const {
      invitation,
      connectionRecord: { id: faberConnectionId },
    } = await faberAgent.connections.createConnection({
      multiUseInvitation: true,
    })

    const invitationUrl = invitation.toUrl({ domain: 'https://example.com' })

    // Create first connection
    let aliceFaberConnection1 = await aliceAgent.connections.receiveInvitationFromUrl(invitationUrl)
    aliceFaberConnection1 = await aliceAgent.connections.returnWhenIsConnected(aliceFaberConnection1.id)
    expect(aliceFaberConnection1.state).toBe(ConnectionState.Complete)

    // Create second connection
    let aliceFaberConnection2 = await aliceAgent.connections.receiveInvitationFromUrl(invitationUrl)
    aliceFaberConnection2 = await aliceAgent.connections.returnWhenIsConnected(aliceFaberConnection2.id)
    expect(aliceFaberConnection2.state).toBe(ConnectionState.Complete)

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    let faberAliceConnection1 = await faberAgent.connections.getByThreadId(aliceFaberConnection1.threadId!)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    let faberAliceConnection2 = await faberAgent.connections.getByThreadId(aliceFaberConnection2.threadId!)

    faberAliceConnection1 = await faberAgent.connections.returnWhenIsConnected(faberAliceConnection1.id)
    faberAliceConnection2 = await faberAgent.connections.returnWhenIsConnected(faberAliceConnection2.id)

    expect(faberAliceConnection1).toBeConnectedWith(aliceFaberConnection1)
    expect(faberAliceConnection2).toBeConnectedWith(aliceFaberConnection2)

    const faberConnection = await faberAgent.connections.getById(faberConnectionId)
    // Expect initial connection to still be in state invited
    return expect(faberConnection.state).toBe(ConnectionState.Invited)
  })
})
