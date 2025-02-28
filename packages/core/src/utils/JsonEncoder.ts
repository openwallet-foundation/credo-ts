import { base64ToBase64URL } from './base64'
import { Buffer } from './buffer'

// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
export class JsonEncoder {
  /**
   * Encode json object into base64 string.
   *
   * @param json the json object to encode into base64 string
   */
  public static toBase64(json: unknown) {
    return JsonEncoder.toBuffer(json).toString('base64')
  }

  /**
   * Encode json object into base64url string.
   *
   * @param json the json object to encode into base64url string
   */
  public static toBase64URL(json: unknown) {
    return base64ToBase64URL(JsonEncoder.toBase64(json))
  }

  /**
   * Decode base64 string into json object. Also supports base64url
   *
   * @param base64 the base64 or base64url string to decode into json
   */
  public static fromBase64(base64: string) {
    return JsonEncoder.fromBuffer(Buffer.from(base64, 'base64'))
  }

  /**
   * Encode json object into string
   *
   * @param json the json object to encode into string
   */
  public static toString(json: unknown) {
    return JSON.stringify(json)
  }

  /**
   * Decode string into json object
   *
   * @param string the string to decode into json
   */
  public static fromString(string: string) {
    return JSON.parse(string)
  }

  /**
   * Encode json object into buffer
   *
   * @param json the json object to encode into buffer format
   */
  public static toBuffer(json: unknown) {
    return Buffer.from(JsonEncoder.toString(json))
  }

  /**
   * Decode buffer into json object
   *
   * @param buffer the buffer to decode into json
   */
  public static fromBuffer(buffer: Buffer | Uint8Array) {
    return JsonEncoder.fromString(Buffer.from(buffer).toString('utf-8'))
  }
}
