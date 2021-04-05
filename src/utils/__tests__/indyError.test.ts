import { isIndyError } from '../indyError'

describe('isIndyError()', () => {
  it('should return true when the name is "IndyError" and no errorName is passed', () => {
    const error = { name: 'IndyError' }

    expect(isIndyError(error)).toBe(true)
  })

  it('should return false when the name is not "IndyError"', () => {
    const error = { name: 'IndyError2' }

    expect(isIndyError(error)).toBe(false)
    expect(isIndyError(error, 'WalletAlreadyExistsError')).toBe(false)
  })

  it('should return true when indyName matches the passed errorName', () => {
    const error = { name: 'IndyError', indyName: 'WalletAlreadyExistsError' }

    expect(isIndyError(error, 'WalletAlreadyExistsError')).toBe(true)
  })

  it('should return false when the indyName does not match the passes errorName', () => {
    const error = { name: 'IndyError', indyName: 'WalletAlreadyExistsError' }

    expect(isIndyError(error, 'DoesNotMatchError')).toBe(false)
  })

  // Below here are temporary until indy-sdk releases new version
  it('should return true when the indyName is missing but the message contains a matching error code', () => {
    const error = { name: 'IndyError', message: '212' }

    expect(isIndyError(error, 'WalletItemNotFound')).toBe(true)
  })

  it('should return false when the indyName is missing and the message contains a valid but not matching error code', () => {
    const error = { name: 'IndyError', message: '212' }

    expect(isIndyError(error, 'DoesNotMatchError')).toBe(false)
  })

  it('should throw an error when the indyName is missing and the message contains an invalid error code', () => {
    const error = { name: 'IndyError', message: '832882' }

    expect(() => isIndyError(error, 'SomeNewErrorWeDoNotHave')).toThrowError(
      'Could not determine errorName of indyError 832882'
    )
  })
})
