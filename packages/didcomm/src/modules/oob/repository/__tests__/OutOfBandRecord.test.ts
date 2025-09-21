import { JsonTransformer } from '../../../../../../core'
import { DidCommOutOfBandRole } from '../../domain/DidCommOutOfBandRole'
import { DidCommOutOfBandState } from '../../domain/DidCommOutOfBandState'
import { OutOfBandDidCommService } from '../../domain/OutOfBandDidCommService'
import { DidCommOutOfBandInvitation } from '../../messages'
import { DidCommOutOfBandRecord } from '../DidCommOutOfBandRecord'

describe('DidCommOutOfBandRecord', () => {
  describe('getTags', () => {
    it('should return default tags', () => {
      const outOfBandRecord = new DidCommOutOfBandRecord({
        state: DidCommOutOfBandState.Done,
        role: DidCommOutOfBandRole.Receiver,
        outOfBandInvitation: new DidCommOutOfBandInvitation({
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
        tags: {
          recipientKeyFingerprints: ['z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th'],
        },
      })

      expect(outOfBandRecord.getTags()).toEqual({
        state: DidCommOutOfBandState.Done,
        role: DidCommOutOfBandRole.Receiver,
        invitationId: 'a-message-id',
        threadId: 'a-message-id',
        recipientKeyFingerprints: ['z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th'],
      })
    })
  })

  describe('clone', () => {
    test('should correctly clone the record', () => {
      const jsonRecord = {
        _tags: {},
        metadata: {},
        id: 'd565b4d8-3e5d-42da-a87c-4454fdfbaff0',
        createdAt: '2022-06-02T18:35:06.374Z',
        outOfBandInvitation: {
          '@type': 'https://didcomm.org/out-of-band/1.1/invitation',
          '@id': '5d57ca2d-80ed-432c-8def-c40c75e8ab09',
          label: 'Faber College',
          goalCode: 'p2p-messaging',
          goal: 'To make a connection',
          accept: ['didcomm/aip1', 'didcomm/aip2;env=rfc19'],
          handshake_protocols: ['https://didcomm.org/didexchange/1.0', 'https://didcomm.org/connections/1.0'],
          services: [
            {
              id: '#inline-0',
              serviceEndpoint: 'rxjs:faber',
              type: 'did-communication',
              recipientKeys: ['did:key:z6MkhngxtGfzTvGVbFjVVqBHvniY1f2XrTMZLM5BZvPh31Dc'],
              routingKeys: [],
            },
          ],
        },
        role: 'sender',
        state: 'await-response',
        autoAcceptConnection: true,
        reusable: false,
      }

      const oobRecord = JsonTransformer.fromJSON(jsonRecord, DidCommOutOfBandRecord)

      expect(oobRecord.toJSON()).toMatchObject(oobRecord.clone().toJSON())
    })
  })
})
