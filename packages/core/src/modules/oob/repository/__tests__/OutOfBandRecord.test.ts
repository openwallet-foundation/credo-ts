import { OutOfBandDidCommService } from '../../domain/OutOfBandDidCommService'
import { OutOfBandRole } from '../../domain/OutOfBandRole'
import { OutOfBandState } from '../../domain/OutOfBandState'
import { OutOfBandInvitation } from '../../messages'
import { OutOfBandRecord } from '../OutOfBandRecord'

describe('OutOfBandRecord', () => {
  describe('getTags', () => {
    it('should return default tags', () => {
      const outOfBandRecord = new OutOfBandRecord({
        state: OutOfBandState.Done,
        role: OutOfBandRole.Receiver,
        outOfBandInvitation: new OutOfBandInvitation({
          label: 'label',
          services: [
            new OutOfBandDidCommService({
              id: 'id',
              recipientKeys: ['did:key:z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th'],
              serviceEndpoint: 'service-endpoint',
            }),
          ],
          id: 'a-message-id',
        }),
      })

      expect(outOfBandRecord.getTags()).toEqual({
        state: OutOfBandState.Done,
        role: OutOfBandRole.Receiver,
        invitationId: 'a-message-id',
        recipientKeyFingerprints: ['z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th'],
      })
    })
  })
})
