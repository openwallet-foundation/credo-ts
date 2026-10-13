import { DidCommTrustPingMessage } from '../../../../didcomm/src'
import { ClassValidationError } from '../../error/ClassValidationError'
import { JsonTransformer } from '../JsonTransformer'
import { MessageValidator } from '../MessageValidator'

describe('MessageValidator', () => {
  describe('validateSync', () => {
    it('validates a class instance correctly', () => {
      const ping = new DidCommTrustPingMessage({
        id: 'afe2867e-58c3-4a8d-85b2-23370dd9c9f0',
        comment: 'test-comment',
      })

      expect(MessageValidator.validateSync(ping)).toBeUndefined()
    })
    it('throws an error for invalid class instance', () => {
      const ping = JsonTransformer.fromJSON(
        {
          '@type': 'https://didcomm.org/trust_ping/1.0/ping',
          '@id': 'afe2867e-58c3-4a8d-85b2-23370dd9c9f0',
          response_requested: 'not-a-boolean',
        },
        DidCommTrustPingMessage,
        { validate: false }
      )

      expect(() => MessageValidator.validateSync(ping)).toThrow(ClassValidationError)
    })
  })
})
