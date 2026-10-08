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

  test('is a native error', () => {
    const error = new CustomError('message')

    expect(error).toBeInstanceOf(Error)
    expect(Object.prototype.toString.call(error)).toBe('[object Error]')

    const errorConstructor = Error as ErrorConstructor & { isError?: (value: unknown) => boolean }
    if (typeof errorConstructor.isError === 'function') {
      expect(errorConstructor.isError(error)).toBe(true)
    }
  })

  test('uses the class name as name', () => {
    const error = new CustomError('message')

    expect(error.name).toBe('CustomError')
    expect(String(error)).toBe('CustomError: message')
    expect(error.stack).toMatch(/^CustomError: message/)
  })

  test('keeps name and cause out of the enumerable properties', () => {
    const cause = new Error('cause')
    const error = new CustomError('message', { cause })

    expect(Object.keys(error)).toEqual([])
    expect(JSON.stringify(error)).toBe('{}')
    expect(error.cause).toBe(cause)
    expect(Object.getOwnPropertyDescriptor(error, 'cause')).toMatchObject({ writable: false, enumerable: false })
  })

  test('compares the message in toThrow and toEqual', () => {
    expect(() => {
      throw new CustomError('message')
    }).toThrow(new CustomError('message'))

    expect(() =>
      expect(() => {
        throw new CustomError('message')
      }).toThrow(new CustomError('other message'))
    ).toThrow()

    expect(new CustomError('message')).toEqual(new CustomError('message'))
    expect(new CustomError('message')).not.toEqual(new CustomError('other message'))
  })

  test('inspect returns the full cause chain', () => {
    const error = new CustomError('outer', { cause: new CustomError('inner') })

    const inspected = error.inspect()
    expect(inspected).toContain('outer')
    expect(inspected).toContain('The following exception was the direct cause of the above exception')
    expect(inspected).toContain('inner')
  })
})
