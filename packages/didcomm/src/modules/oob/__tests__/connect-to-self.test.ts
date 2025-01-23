/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { SubjectMessage } from '../../../../../../tests/transport/SubjectInboundTransport'

import { Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../../../../tests/transport/SubjectOutboundTransport'
import { Agent } from '../../../../../core'
import { getInMemoryAgentOptions } from '../../../../../core/tests/helpers'
import { HandshakeProtocol, DidExchangeState } from '../../connections'
import { OutOfBandState } from '../domain/OutOfBandState'

const faberAgentOptions = getInMemoryAgentOptions('Faber Agent OOB Connect to Self', {
  endpoints: ['rxjs:faber'],
})

describe('out of band', () => {
  let faberAgent: Agent

  beforeEach(async () => {
    const faberMessages = new Subject<SubjectMessage>()
    const subjectMap = {
      'rxjs:faber': faberMessages,
    }

    faberAgent = new Agent(faberAgentOptions)

    faberAgent.modules.didcomm.registerInboundTransport(new SubjectInboundTransport(faberMessages))
    faberAgent.modules.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await faberAgent.initialize()
  })

  afterEach(async () => {
    await faberAgent.shutdown()
    await faberAgent.wallet.delete()
  })

  describe('connect with self', () => {
    test(`make a connection with self using ${HandshakeProtocol.DidExchange} protocol`, async () => {
      const outOfBandRecord = await faberAgent.modules.oob.createInvitation()
      const { outOfBandInvitation } = outOfBandRecord
      const urlMessage = outOfBandInvitation.toUrl({ domain: 'http://example.com' })

      // eslint-disable-next-line prefer-const
      let { outOfBandRecord: receivedOutOfBandRecord, connectionRecord: receiverSenderConnection } =
        await faberAgent.modules.oob.receiveInvitationFromUrl(urlMessage)
      expect(receivedOutOfBandRecord.state).toBe(OutOfBandState.PrepareResponse)

      receiverSenderConnection = await faberAgent.modules.connections.returnWhenIsConnected(
        receiverSenderConnection!.id
      )
      expect(receiverSenderConnection.state).toBe(DidExchangeState.Completed)

      let [senderReceiverConnection] = await faberAgent.modules.connections.findAllByOutOfBandId(outOfBandRecord.id)
      senderReceiverConnection = await faberAgent.modules.connections.returnWhenIsConnected(senderReceiverConnection.id)
      expect(senderReceiverConnection.state).toBe(DidExchangeState.Completed)
      expect(senderReceiverConnection.protocol).toBe(HandshakeProtocol.DidExchange)

      expect(receiverSenderConnection).toBeConnectedWith(senderReceiverConnection!)
      expect(senderReceiverConnection).toBeConnectedWith(receiverSenderConnection)
    })

    test(`make a connection with self using https://didcomm.org/didexchange/1.1 protocol, but invitation using https://didcomm.org/didexchange/1.0`, async () => {
      const outOfBandRecord = await faberAgent.modules.oob.createInvitation()

      const { outOfBandInvitation } = outOfBandRecord
      outOfBandInvitation.handshakeProtocols = ['https://didcomm.org/didexchange/1.0']
      const urlMessage = outOfBandInvitation.toUrl({ domain: 'http://example.com' })

      // eslint-disable-next-line prefer-const
      let { outOfBandRecord: receivedOutOfBandRecord, connectionRecord: receiverSenderConnection } =
        await faberAgent.modules.oob.receiveInvitationFromUrl(urlMessage)
      expect(receivedOutOfBandRecord.state).toBe(OutOfBandState.PrepareResponse)

      receiverSenderConnection = await faberAgent.modules.connections.returnWhenIsConnected(
        receiverSenderConnection!.id
      )
      expect(receiverSenderConnection.state).toBe(DidExchangeState.Completed)

      let [senderReceiverConnection] = await faberAgent.modules.connections.findAllByOutOfBandId(outOfBandRecord.id)
      senderReceiverConnection = await faberAgent.modules.connections.returnWhenIsConnected(senderReceiverConnection.id)
      expect(senderReceiverConnection.state).toBe(DidExchangeState.Completed)
      expect(senderReceiverConnection.protocol).toBe(HandshakeProtocol.DidExchange)

      expect(receiverSenderConnection).toBeConnectedWith(senderReceiverConnection!)
      expect(senderReceiverConnection).toBeConnectedWith(receiverSenderConnection)
    })

    test(`make a connection with self using ${HandshakeProtocol.Connections} protocol`, async () => {
      const outOfBandRecord = await faberAgent.modules.oob.createInvitation({
        handshakeProtocols: [HandshakeProtocol.Connections],
      })
      const { outOfBandInvitation } = outOfBandRecord
      const urlMessage = outOfBandInvitation.toUrl({ domain: 'http://example.com' })

      // eslint-disable-next-line prefer-const
      let { outOfBandRecord: receivedOutOfBandRecord, connectionRecord: receiverSenderConnection } =
        await faberAgent.modules.oob.receiveInvitationFromUrl(urlMessage)
      expect(receivedOutOfBandRecord.state).toBe(OutOfBandState.PrepareResponse)

      receiverSenderConnection = await faberAgent.modules.connections.returnWhenIsConnected(
        receiverSenderConnection!.id
      )
      expect(receiverSenderConnection.state).toBe(DidExchangeState.Completed)

      let [senderReceiverConnection] = await faberAgent.modules.connections.findAllByOutOfBandId(outOfBandRecord.id)
      senderReceiverConnection = await faberAgent.modules.connections.returnWhenIsConnected(senderReceiverConnection.id)
      expect(senderReceiverConnection.state).toBe(DidExchangeState.Completed)
      expect(senderReceiverConnection.protocol).toBe(HandshakeProtocol.Connections)

      expect(receiverSenderConnection).toBeConnectedWith(senderReceiverConnection!)
      expect(senderReceiverConnection).toBeConnectedWith(receiverSenderConnection)
    })
  })
})
