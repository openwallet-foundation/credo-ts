import { ClassValidationError } from '../../../../../core/src/error/ClassValidationError'
import { MessageValidator } from '../../../../../core/src/utils'
import { ConnectionRequestMessage } from '../messages/ConnectionRequestMessage'

describe('ConnectionRequestMessage', () => {
  it('throws an error when the message does not contain a connection parameter', () => {
    const connectionRequest = new ConnectionRequestMessage({
      did: 'did',
      label: 'test-label',
    })

    // @ts-ignore
    // biome-ignore lint/performance/noDelete: <explanation>
    delete connectionRequest.connection

    expect(() => MessageValidator.validateSync(connectionRequest)).toThrowError(ClassValidationError)
  })
})
