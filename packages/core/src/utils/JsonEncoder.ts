import type { Uint8ArrayBuffer } from '../types'
import { TypedArrayEncoder } from './TypedArrayEncoder'

// biome-ignore lint/complexity/noStaticOnlyClass: no explanation
export class JsonEncoder {
  /**
   * Encode json object into a base64 string
   */
  public static toBase64(json: unknown) {
    return TypedArrayEncoder.toBase64(TypedArrayEncoder.fromUtf8String(JsonEncoder.toString(json)))
  }

  /**
   * @deprecated use `toBase64Url
   */
  public static toBase64URL(json: unknown) {
    return JsonEncoder.toBase64Url(json)
  }

  /**
   * Encode json object into a base64url string
   */
  public static toBase64Url(json: unknown) {
    return TypedArrayEncoder.toBase64Url(TypedArrayEncoder.fromUtf8String(JsonEncoder.toString(json)))
  }

  /**
   * Decode base64 string into a json object.
   *
   * @note Also supports base64url
   */
  public static fromBase64(base64: string) {
    return JsonEncoder.fromUint8Array(TypedArrayEncoder.fromBase64(base64))
  }

  /**
   * Decode base64url string into a json object.
   */
  public static fromBase64Url(base64: string) {
    return JsonEncoder.fromUint8Array(TypedArrayEncoder.fromBase64url(base64))
  }

  /**
   * Encode json object into a string
   */
  public static toString(json: unknown) {
    return JSON.stringify(json)
  }

  /**
   * Decode string into a json object
   */
  public static fromString(string: string) {
    return JSON.parse(string)
  }

  /**
   * @deprecated Use `toUint8Array`
   */
  public static toBuffer(json: unknown): Uint8ArrayBuffer {
    return JsonEncoder.toUint8Array(json)
  }

  /**
   * Encode json object into buffer
   */
  public static toUint8Array(json: unknown): Uint8ArrayBuffer {
    return TypedArrayEncoder.fromUtf8String(JsonEncoder.toString(json))
  }

  /**
   * @deprecated Use `fromUint8Array`
   */
  public static fromBuffer(data: Uint8ArrayBuffer) {
    return JsonEncoder.fromUint8Array(data)
  }

  /**
   * Decode buffer into a json object
   */
  public static fromUint8Array(data: Uint8ArrayBuffer) {
    return JsonEncoder.fromString(TypedArrayEncoder.toUtf8String(data))
  }
}
