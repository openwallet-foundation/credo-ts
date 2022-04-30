import { ConnectionRole, ConnectionState } from '../../models'
import { ConnectionRecord } from '../ConnectionRecord'

describe('ConnectionRecord', () => {
  describe('getTags', () => {
    it('should return default tags', () => {
      const didRecord = new ConnectionRecord({
        state: ConnectionState.Complete,
        role: ConnectionRole.Invitee,
        threadId: 'a-thread-id',
        mediatorId: 'a-mediator-id',
        did: 'a-did',
        theirDid: 'a-their-did',
        outOfBandId: 'a-out-of-band-id',
        invitationDid: 'a-invitation-did',
      })

      expect(didRecord.getTags()).toEqual({
        state: ConnectionState.Complete,
        role: ConnectionRole.Invitee,
        threadId: 'a-thread-id',
        mediatorId: 'a-mediator-id',
        did: 'a-did',
        theirDid: 'a-their-did',
        outOfBandId: 'a-out-of-band-id',
        invitationDid: 'a-invitation-did',
      })
    })
  })
})
