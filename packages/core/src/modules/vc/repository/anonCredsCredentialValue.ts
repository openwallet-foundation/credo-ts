import bigInt from 'big-integer'

import { CredoError } from '../../../error'
import { Buffer, Hasher, TypedArrayEncoder } from '../../../utils'

export type AnonCredsClaimRecord = Record<string, string | number | boolean>

export interface AnonCredsCredentialValue {
  raw: string
  encoded: string // Raw value as number in string
}

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
export const encodeCredentialValue = (data: unknown): string => {
  if (typeof data === 'boolean') return data ? '1' : '0'

  // Keep any 32-bit integer as is
  if (typeof data === 'number' && isInt32(data)) {
    return String(data)
  }

  // Convert any string integer (e.g. "1234") to be a 32-bit integer (e.g. 1234)
  if (typeof data === 'string' && data !== '' && !isNaN(Number(data)) && isNumeric(data) && isInt32(Number(data))) {
    return Number(data).toString()
  }

  data = data === undefined || data === null ? 'None' : data

  const buffer = TypedArrayEncoder.fromString(String(data))
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
