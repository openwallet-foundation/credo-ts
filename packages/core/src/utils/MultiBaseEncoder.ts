import multibase from 'multibase'

export type BaseName = multibase.BaseName

export class MultiBaseEncoder {
  /**
   *
   * Encodes a buffer into a multibase
   *
   * @param {Uint8Array} buffer the buffer that has to be encoded
   * @param {multibase.BaseName} baseName the encoding algorithm
   */
  public static encode(buffer: Uint8Array, baseName: multibase.BaseName = 'base58btc') {
    return multibase.encode(baseName, buffer)
  }

  /**
   *
   * Decodes a multibase into a Uint8Array
   *
   * @param {string} data the multibase that has to be decoded
   *
   * @returns {Uint8array} data the decoded multibase
   * @returns {string} encodingAlgorithm name of the encoding algorithm
   */
  public static decode(data: string | Uint8Array): { data: Uint8Array; baseName: string } {
    if (this.isValid(data)) {
      const baseName = multibase.encodingFromData(data).name
      return { data: multibase.decode(data), baseName }
    }
    throw new Error(`Invalid multibase: ${data}`)
  }

  /**
   *
   * Validates if it is a valid multibase encoded value
   *
   * @param {Uint8Array} data the multibase that needs to be validated
   *
   * @returns {boolean} bool whether the multibase value is encoded
   */
  public static isValid(data: string | Uint8Array): boolean {
    return multibase.isEncoded(data) ? true : false
  }
}
