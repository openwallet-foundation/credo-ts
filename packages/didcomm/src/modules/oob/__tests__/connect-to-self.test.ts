import { Subject } from 'rxjs'
import type { SubjectMessage } from '../../../../../../tests/transport/SubjectInboundTransport'

import { SubjectInboundTransport } from '../../../../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../../../../tests/transport/SubjectOutboundTransport'
import { Agent } from '../../../../../core/src/index'
import { getAgentOptions } from '../../../../../core/tests/helpers'
import { DidCommDidExchangeState, DidCommHandshakeProtocol } from '../../connections'
import { DidCommOutOfBandState } from '../domain/DidCommOutOfBandState'

const faberAgentOptions = getAgentOptions(
  'Faber Agent OOB Connect to Self',
  {
    endpoints: ['rxjs:faber'],
  },
  undefined,
  undefined,
  { requireDidcomm: true }
)

describe('out of band', () => {
  let faberAgent: Agent

  beforeEach(async () => {
    const faberMessages = new Subject<SubjectMessage>()
    const subjectMap = {
      'rxjs:faber': faberMessages,
    }

    faberAgent = new Agent(faberAgentOptions)

    faberAgent.didcomm.registerInboundTransport(new SubjectInboundTransport(faberMessages))
    faberAgent.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await faberAgent.initialize()
  })

  afterEach(async () => {
    await faberAgent.shutdown()
  })

  describe('connect with self', () => {
    test(`make a connection with self using ${DidCommHandshakeProtocol.DidExchange} protocol`, async () => {
      const outOfBandRecord = await faberAgent.didcomm.oob.createInvitation()
      const { outOfBandInvitation } = outOfBandRecord
      const urlMessage = outOfBandInvitation.toUrl({ domain: 'http://example.com' })

      let { outOfBandRecord: receivedOutOfBandRecord, connectionRecord: receiverSenderConnection } =
        await faberAgent.didcomm.oob.receiveInvitationFromUrl(urlMessage, { label: 'faber' })
      expect(receivedOutOfBandRecord.state).toBe(DidCommOutOfBandState.PrepareResponse)

      receiverSenderConnection = await faberAgent.didcomm.connections.returnWhenIsConnected(
        receiverSenderConnection?.id
      )
      expect(receiverSenderConnection.state).toBe(DidCommDidExchangeState.Completed)

      let [senderReceiverConnection] = await faberAgent.didcomm.connections.findAllByOutOfBandId(outOfBandRecord.id)
      senderReceiverConnection = await faberAgent.didcomm.connections.returnWhenIsConnected(senderReceiverConnection.id)
      expect(senderReceiverConnection.state).toBe(DidCommDidExchangeState.Completed)
      expect(senderReceiverConnection.protocol).toBe(DidCommHandshakeProtocol.DidExchange)

      // biome-ignore lint/style/noNonNullAssertion: no explanation
      expect(receiverSenderConnection).toBeConnectedWith(senderReceiverConnection!)
      expect(senderReceiverConnection).toBeConnectedWith(receiverSenderConnection)
    })

    test('make a connection with self using https://didcomm.org/didexchange/1.1 protocol, but invitation using https://didcomm.org/didexchange/1.0', async () => {
      const outOfBandRecord = await faberAgent.didcomm.oob.createInvitation()

      const { outOfBandInvitation } = outOfBandRecord
      outOfBandInvitation.handshakeProtocols = ['https://didcomm.org/didexchange/1.0']
      const urlMessage = outOfBandInvitation.toUrl({ domain: 'http://example.com' })

      let { outOfBandRecord: receivedOutOfBandRecord, connectionRecord: receiverSenderConnection } =
        await faberAgent.didcomm.oob.receiveInvitationFromUrl(urlMessage, { label: 'faber' })
      expect(receivedOutOfBandRecord.state).toBe(DidCommOutOfBandState.PrepareResponse)

      receiverSenderConnection = await faberAgent.didcomm.connections.returnWhenIsConnected(
        receiverSenderConnection?.id
      )
      expect(receiverSenderConnection.state).toBe(DidCommDidExchangeState.Completed)

      let [senderReceiverConnection] = await faberAgent.didcomm.connections.findAllByOutOfBandId(outOfBandRecord.id)
      senderReceiverConnection = await faberAgent.didcomm.connections.returnWhenIsConnected(senderReceiverConnection.id)
      expect(senderReceiverConnection.state).toBe(DidCommDidExchangeState.Completed)
      expect(senderReceiverConnection.protocol).toBe(DidCommHandshakeProtocol.DidExchange)

      // biome-ignore lint/style/noNonNullAssertion: no explanation
      expect(receiverSenderConnection).toBeConnectedWith(senderReceiverConnection!)
      expect(senderReceiverConnection).toBeConnectedWith(receiverSenderConnection)
    })

    test(`make a connection with self using ${DidCommHandshakeProtocol.Connections} protocol`, async () => {
      const outOfBandRecord = await faberAgent.didcomm.oob.createInvitation({
        handshakeProtocols: [DidCommHandshakeProtocol.Connections],
      })
      const { outOfBandInvitation } = outOfBandRecord
      const urlMessage = outOfBandInvitation.toUrl({ domain: 'http://example.com' })

      let { outOfBandRecord: receivedOutOfBandRecord, connectionRecord: receiverSenderConnection } =
        await faberAgent.didcomm.oob.receiveInvitationFromUrl(urlMessage, { label: 'faber' })
      expect(receivedOutOfBandRecord.state).toBe(DidCommOutOfBandState.PrepareResponse)

      receiverSenderConnection = await faberAgent.didcomm.connections.returnWhenIsConnected(
        receiverSenderConnection?.id
      )
      expect(receiverSenderConnection.state).toBe(DidCommDidExchangeState.Completed)

      let [senderReceiverConnection] = await faberAgent.didcomm.connections.findAllByOutOfBandId(outOfBandRecord.id)
      senderReceiverConnection = await faberAgent.didcomm.connections.returnWhenIsConnected(senderReceiverConnection.id)
      expect(senderReceiverConnection.state).toBe(DidCommDidExchangeState.Completed)
      expect(senderReceiverConnection.protocol).toBe(DidCommHandshakeProtocol.Connections)

      // biome-ignore lint/style/noNonNullAssertion: no explanation
      expect(receiverSenderConnection).toBeConnectedWith(senderReceiverConnection!)
      expect(senderReceiverConnection).toBeConnectedWith(receiverSenderConnection)
    })
  })
})
