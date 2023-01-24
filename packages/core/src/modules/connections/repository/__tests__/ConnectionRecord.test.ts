import { DidExchangeRole, DidExchangeState } from '../../models'
import { ConnectionRecord } from '../ConnectionRecord'

describe('ConnectionRecord', () => {
  describe('getTags', () => {
    it('should return default tags', () => {
      const connectionRecord = new ConnectionRecord({
        state: DidExchangeState.Completed,
        role: DidExchangeRole.Requester,
        threadId: 'a-thread-id',
        mediatorId: 'a-mediator-id',
        did: 'a-did',
        theirDid: 'a-their-did',
        outOfBandId: 'a-out-of-band-id',
        invitationDid: 'a-invitation-did',
      })

      expect(connectionRecord.getTags()).toEqual({
        state: DidExchangeState.Completed,
        role: DidExchangeRole.Requester,
        threadId: 'a-thread-id',
        mediatorId: 'a-mediator-id',
        did: 'a-did',
        theirDid: 'a-their-did',
        outOfBandId: 'a-out-of-band-id',
        invitationDid: 'a-invitation-did',
        connectionTypes: [],
      })
    })
  })
})
