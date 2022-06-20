import { ValidationError } from 'class-validator'

import { isValidationErrorArray } from '../ValidationErrorUtils'

describe('ValidationErrorUtils', () => {
  test('returns true for an array of ValidationErrors', () => {
    const error = new ValidationError()
    const errorArray = [error, error]
    const isErrorArray = isValidationErrorArray(errorArray)
    expect(isErrorArray).toBeTruthy
  })

  test('returns false for an array of strings', () => {
    const errorArray = ['hello', 'world']
    const isErrorArray = isValidationErrorArray(errorArray)
    expect(isErrorArray).toBeFalsy
  })

  test('returns false for a non array', () => {
    const error = new ValidationError()
    const isErrorArray = isValidationErrorArray(error)
    expect(isErrorArray).toBeFalsy
  })
})
