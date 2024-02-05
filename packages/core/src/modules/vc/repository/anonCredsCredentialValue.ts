import bigInt from 'big-integer'

import { CredoError } from '../../../error'
import { Buffer, Hasher, TypedArrayEncoder } from '../../../utils'

export type AnonCredsClaimRecord = Record<string, string | number | boolean>

export interface AnonCredsCredentialValue {
  raw: string
  encoded: string // Raw value as number in string
}

const isString = (value: unknown): value is string => typeof value === 'string'
const isNumber = (value: unknown): value is number => typeof value === 'number'
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'
const isNumeric = (value: string) => /^-?\d+$/.test(value)

const isInt32 = (number: number) => {
  const minI32 = -2147483648
  const maxI32 = 2147483647

  // Check if number is integer and in range of int32
  return Number.isInteger(number) && number >= minI32 && number <= maxI32
}

// TODO: this function can only encode strings
// If encoding numbers we run into problems with 0.0 representing the same value as 0 and is implicitly converted to 0
/**
 * Encode value according to the encoding format described in Aries RFC 0036/0037
 *
 * @param value
 * @returns Encoded version of value
 *
 * @see https://github.com/hyperledger/aries-cloudagent-python/blob/0000f924a50b6ac5e6342bff90e64864672ee935/aries_cloudagent/messaging/util.py#L106-L136
 * @see https://github.com/hyperledger/aries-rfcs/blob/be4ad0a6fb2823bb1fc109364c96f077d5d8dffa/features/0037-present-proof/README.md#verifying-claims-of-indy-based-verifiable-credentials
 * @see https://github.com/hyperledger/aries-rfcs/blob/be4ad0a6fb2823bb1fc109364c96f077d5d8dffa/features/0036-issue-credential/README.md#encoding-claims-for-indy-based-verifiable-credentials
 */
export function encodeCredentialValue(value: unknown) {
  const isEmpty = (value: unknown) => isString(value) && value === ''

  // If bool return bool as number string
  if (isBoolean(value)) {
    return Number(value).toString()
  }

  // If value is int32 return as number string
  if (isNumber(value) && isInt32(value)) {
    return value.toString()
  }

  // If value is an int32 number string return as number string
  if (isString(value) && !isEmpty(value) && !isNaN(Number(value)) && isNumeric(value) && isInt32(Number(value))) {
    return Number(value).toString()
  }

  if (isNumber(value)) {
    value = value.toString()
  }

  // If value is null we must use the string value 'None'
  if (value === null || value === undefined) {
    value = 'None'
  }

  const buffer = TypedArrayEncoder.fromString(String(value))
  const hash = Hasher.hash(buffer, 'sha-256')
  const hex = Buffer.from(hash).toString('hex')

  return bigInt(hex, 16).toString()
}

export const mapAttributeRawValuesToAnonCredsCredentialValues = (
  record: AnonCredsClaimRecord
): Record<string, AnonCredsCredentialValue> => {
  const credentialValues: Record<string, AnonCredsCredentialValue> = {}

  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'object') {
      throw new CredoError(`Unsupported value type: object for W3cAnonCreds Credential`)
    }
    credentialValues[key] = {
      raw: value.toString(),
      encoded: encodeCredentialValue(value),
    }
  }

  return credentialValues
}
