import { JsonTransformer } from '../../../../../../core/src/utils'
import { DidCommDidExchangeRole, DidCommDidExchangeState, DidCommHandshakeProtocol } from '../../models'
import { DidCommConnectionRecord } from '../DidCommConnectionRecord'

describe('DidCommConnectionRecord', () => {
  describe('getTags', () => {
    it('should return default tags', () => {
      const connectionRecord = new DidCommConnectionRecord({
        state: DidCommDidExchangeState.Completed,
        role: DidCommDidExchangeRole.Requester,
        threadId: 'a-thread-id',
        mediatorId: 'a-mediator-id',
        did: 'a-did',
        theirDid: 'a-their-did',
        outOfBandId: 'a-out-of-band-id',
        invitationDid: 'a-invitation-did',
      })

      expect(connectionRecord.getTags()).toEqual({
        state: DidCommDidExchangeState.Completed,
        role: DidCommDidExchangeRole.Requester,
        threadId: 'a-thread-id',
        mediatorId: 'a-mediator-id',
        did: 'a-did',
        theirDid: 'a-their-did',
        outOfBandId: 'a-out-of-band-id',
        invitationDid: 'a-invitation-did',
        connectionTypes: [],
        previousDids: [],
        previousTheirDids: [],
      })
    })
  })

  it('should transform handshake protocol with minor version to .x', () => {
    const connectionRecord = JsonTransformer.fromJSON(
      {
        protocol: 'https://didcomm.org/didexchange/1.0',
      },
      DidCommConnectionRecord
    )

    expect(connectionRecord.protocol).toEqual(DidCommHandshakeProtocol.DidExchange)
  })

  it('should not transform handshake protocol when minor version is .x', () => {
    const connectionRecord = JsonTransformer.fromJSON(
      {
        protocol: 'https://didcomm.org/didexchange/1.x',
      },
      DidCommConnectionRecord
    )

    expect(connectionRecord.protocol).toEqual(DidCommHandshakeProtocol.DidExchange)
  })
})
