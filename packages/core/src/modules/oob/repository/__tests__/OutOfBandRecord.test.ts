import { DidCommService } from '../../../dids'
import { OutOfBandRole } from '../../domain/OutOfBandRole'
import { OutOfBandState } from '../../domain/OutOfBandState'
import { OutOfBandMessage } from '../../messages'
import { OutOfBandRecord } from '../OutOfBandRecord'

describe('OutOfBandRecord', () => {
  describe('getTags', () => {
    it('should return default tags', () => {
      const didRecord = new OutOfBandRecord({
        state: OutOfBandState.Done,
        role: OutOfBandRole.Receiver,
        outOfBandMessage: new OutOfBandMessage({
          label: 'label',
          services: [
            new DidCommService({
              id: 'id',
              recipientKeys: ['a-recpipient-key'],
              serviceEndpoint: 'service-endpoint',
            }),
          ],
          id: 'a-message-id',
        }),
      })

      expect(didRecord.getTags()).toEqual({
        state: OutOfBandState.Done,
        role: OutOfBandRole.Receiver,
        messageId: 'a-message-id',
        recipientKey: 'a-recpipient-key',
      })
    })
  })
})
