import { JsonTransformer } from '@credo-ts/core'

import { normalizeV2PlaintextToV1 } from '../../../v2/normalize'
import { buildV2PlaintextFromMessage } from '../../../v2/plaintextBuilder'
import { DidCommEmptyMessage } from '../DidCommEmptyMessage'

describe('DidCommEmptyMessage', () => {
  it('sends the acknowledged message ids as the ack header', () => {
    const message = new DidCommEmptyMessage({ id: 'empty-1', ack: ['invalidate-1'] })

    expect(buildV2PlaintextFromMessage(message)).toEqual({
      id: 'empty-1',
      type: 'https://didcomm.org/empty/1.0/empty',
      body: {},
      ack: ['invalidate-1'],
    })
  })

  it('omits the ack header when there is nothing to acknowledge', () => {
    const message = new DidCommEmptyMessage({ id: 'empty-1' })

    expect(buildV2PlaintextFromMessage(message)).toEqual({
      id: 'empty-1',
      type: 'https://didcomm.org/empty/1.0/empty',
      body: {},
    })
  })

  it('reads the ack header of a received empty message', () => {
    const v1 = normalizeV2PlaintextToV1({
      id: 'empty-1',
      type: 'https://didcomm.org/empty/1.0/empty',
      ack: ['invalidate-1'],
      body: {},
    })

    const message = JsonTransformer.fromJSON(v1, DidCommEmptyMessage)
    expect(message.ack).toEqual(['invalidate-1'])
  })
})
