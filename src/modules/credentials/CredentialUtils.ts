import type { CredValues } from 'indy-sdk'
import { sha256 } from 'js-sha256'
import BigNumber from 'bn.js'

import { CredentialPreview } from './messages/CredentialPreview'

export class CredentialUtils {
  /**
   * Converts int value to string
   * Converts string value:
   * - hash with sha256,
   * - convert to byte array and reverse it
   * - convert it to BigInteger and return as a string
   * @param credentialPreview
   *
   * @returns CredValues
   */
  public static convertPreviewToValues(credentialPreview: CredentialPreview): CredValues {
    return credentialPreview.attributes.reduce((credentialValues, attribute) => {
      return {
        [attribute.name]: {
          raw: attribute.value,
          encoded: CredentialUtils.encode(attribute.value),
        },
        ...credentialValues,
      }
    }, {})
  }

  /**
   * Check whether the raw value matches the encoded version according to the encoding format described in Aries RFC 0037
   * Use this method to ensure the received proof (over the encoded) value is the same as the raw value of the data.
   *
   * @param raw
   * @param encoded
   * @returns Whether raw and encoded value match
   *
   * @see https://github.com/hyperledger/aries-framework-dotnet/blob/a18bef91e5b9e4a1892818df7408e2383c642dfa/src/Hyperledger.Aries/Utils/CredentialUtils.cs#L78-L89
   * @see https://github.com/hyperledger/aries-rfcs/blob/be4ad0a6fb2823bb1fc109364c96f077d5d8dffa/features/0037-present-proof/README.md#verifying-claims-of-indy-based-verifiable-credentials
   */
  public static checkValidEncoding(raw: any, encoded: string) {
    return encoded === CredentialUtils.encode(raw)
  }

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
  public static encode(value: any) {
    const isString = typeof value === 'string'
    const isEmpty = isString && value === ''
    const isNumber = typeof value === 'number'
    const isBoolean = typeof value === 'boolean'

    // If bool return bool as number string
    if (isBoolean) {
      return Number(value).toString()
    }

    // If value is int32 return as number string
    if (isNumber && this.isInt32(value)) {
      return value.toString()
    }

    // If value is an int32 number string return as number string
    if (isString && !isEmpty && !isNaN(Number(value)) && this.isInt32(Number(value))) {
      return value
    }

    if (isNumber) {
      value = value.toString()
    }

    // If value is null we must use the string value 'None'
    if (value === null || value === undefined) {
      value = 'None'
    }

    return new BigNumber(sha256.array(value)).toString()
  }

  private static isInt32(number: number) {
    const minI32 = -2147483648
    const maxI32 = 2147483647

    // Check if number is integer and in range of int32
    return Number.isInteger(number) && number >= minI32 && number <= maxI32
  }
}
