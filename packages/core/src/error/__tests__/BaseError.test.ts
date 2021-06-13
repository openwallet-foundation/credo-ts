import { BaseError } from '../BaseError'

class CustomError extends BaseError {
  public constructor(message: string, { cause }: { cause?: Error } = {}) {
    super(message, cause)
  }
}

describe('BaseError', () => {
  test('pass cause to custom error', () => {
    try {
      try {
        JSON.parse('')
      } catch (error) {
        try {
          throw new CustomError('Custom first error message', { cause: error })
        } catch (innerError) {
          throw new CustomError('Custom second error message', { cause: innerError })
        }
      }
    } catch (customError) {
      expect(customError).toBeInstanceOf(CustomError)
      expect(customError.message).toEqual('Custom second error message')

      expect(customError.cause).toBeInstanceOf(CustomError)
      expect(customError.cause.message).toEqual('Custom first error message')

      expect(customError.cause.cause).toBeInstanceOf(SyntaxError)
      expect(customError.cause.cause.message).toEqual('Unexpected end of JSON input')
    }
    expect.assertions(6)
  })
})
