import { ClassValidationError } from '../../../../../core/src/error/ClassValidationError'
import { MessageValidator } from '../../../../../core/src/utils'
import { DidCommConnectionRequestMessage } from '../messages/DidCommConnectionRequestMessage'

describe('ConnectionRequestMessage', () => {
  it('throws an error when the message does not contain a connection parameter', () => {
    const connectionRequest = new DidCommConnectionRequestMessage({
      did: 'did',
      label: 'test-label',
    })

    // @ts-expect-error
    // biome-ignore lint/performance/noDelete: no explanation
    delete connectionRequest.connection

    expect(() => MessageValidator.validateSync(connectionRequest)).toThrow(ClassValidationError)
  })
})
