import { TypedArrayEncoder } from './TypedArrayEncoder'

// biome-ignore lint/complexity/noStaticOnlyClass: no explanation
export class JsonEncoder {
  /**
   * Encode JSON into a base64 string
   */
  public static toBase64(json: unknown) {
    return TypedArrayEncoder.toBase64(TypedArrayEncoder.fromUtf8String(JsonEncoder.toUtf8String(json)))
  }

  /**
   * Encode JSON into a base64url string
   */
  public static toBase64Url(json: unknown) {
    return TypedArrayEncoder.toBase64Url(TypedArrayEncoder.fromUtf8String(JsonEncoder.toUtf8String(json)))
  }

  /**
   * Decode a base64 string into JSON
   */
  public static fromBase64(base64: string) {
    return JsonEncoder.fromUint8Array(TypedArrayEncoder.fromBase64(base64))
  }

  /**
   * Decode a base64-url string into JSON
   */
  public static fromBase64Url(base64: string) {
    return JsonEncoder.fromUint8Array(TypedArrayEncoder.fromBase64Url(base64))
  }

  /**
   * Encode JSON into a string
   */
  public static toUtf8String(json: unknown) {
    return JSON.stringify(json)
  }

  /**
   * Decode a UTF-8 string JSON
   */
  public static fromUtf8String(string: string) {
    return JSON.parse(string)
  }

  /**
   * Encode JSON into a Uint8Array
   */
  public static toUint8Array(json: unknown) {
    return TypedArrayEncoder.fromUtf8String(JsonEncoder.toUtf8String(json))
  }

  /**
   * Decode a Uint8Array into JSON
   */
  public static fromUint8Array(data: Uint8Array) {
    return JsonEncoder.fromUtf8String(TypedArrayEncoder.toUtf8String(data))
  }
}
